import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { unknownUserPolicy, type SignInMethod } from "@/lib/auth-config";
import { isRole } from "@/lib/rbac";
import { getOrganizationUserUsage, requireWithinPlanLimit } from "@/lib/subscription-enforcement";

export type FinalizeResult =
  | { status: "ok"; organizationId: string | null; userId: string }
  | { status: "pending"; userId: string }
  | { status: "denied"; reason: string };

/** Provider from a Supabase user, normalized to our method names. */
export function providerOf(user: User, fallback?: SignInMethod): SignInMethod {
  const raw = fallback || (user.app_metadata?.provider as string | undefined) || "email";
  if (raw === "google" || raw === "azure") return raw;
  return "email";
}

function identityProviders(user: User): string[] {
  const set = new Set<string>();
  for (const identity of user.identities || []) {
    if (identity.provider) set.add(identity.provider);
  }
  for (const p of (user.app_metadata?.providers as string[] | undefined) || []) set.add(p);
  return Array.from(set).sort();
}

function displayName(user: User, email: string) {
  const meta = user.user_metadata || {};
  const name = [meta.full_name, meta.name, [meta.given_name, meta.family_name].filter(Boolean).join(" ")]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean);
  return name || email.split("@")[0];
}

/**
 * Brings the AuditOps user directory in line with a freshly authenticated
 * Supabase user. Called after every successful sign-in (password, Google,
 * Microsoft, invitation, magic link). Decides whether the user may enter.
 *
 * Order:
 *   1. Disabled / Suspended directory users are refused.
 *   2. Invited users are activated together with their invited memberships.
 *   3. Users with no organization access may auto-join an organization that
 *      has verified their email domain (Platform Admin managed).
 *   4. Otherwise: AUTH_UNKNOWN_USER_POLICY (deny | pending).
 */
export async function finalizeSignIn(
  user: User,
  options: { provider?: SignInMethod; ip?: string | null } = {}
): Promise<FinalizeResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const provider = providerOf(user, options.provider);
  const email = (user.email || "").trim().toLowerCase();

  const deny = async (reason: string, extra: Record<string, unknown> = {}) => {
    await writeAuditLog({
      userId: null,
      action: "AUTH_SIGN_IN_DENIED",
      entityType: "auth",
      entityId: user.id,
      newValues: { email, provider, reason, ...extra },
      ipAddress: options.ip,
    });
    return { status: "denied", reason } as const;
  };

  if (!email) return deny("email_missing");

  const { data: existing, error: lookupError } = await admin
    .from("users")
    .select("id,email,status,full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (lookupError) throw new Error(lookupError.message);

  if (!existing) {
    // Same email already owned by a different Auth account (e.g. an old
    // password account and a new OAuth account that Supabase did not link).
    const { data: clash } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (clash && clash.id !== user.id) return deny("account_conflict");
  }

  if (existing?.status === "Disabled") return deny("account_disabled");
  if (existing?.status === "Suspended") return deny("account_suspended");

  const verifiedEmail = Boolean(user.email_confirmed_at);
  let status: "Active" | "Pending" =
    existing && existing.status !== "Pending" ? "Active" : "Pending";

  // Activate invitations.
  if (existing?.status === "Invited") {
    await admin
      .from("organization_memberships")
      .update({ status: "Active", updated_at: now })
      .eq("user_id", user.id)
      .eq("status", "Invited");
  }

  // Does the user have any organization access?
  const { data: memberships } = await admin
    .from("organization_memberships")
    .select("organization_id,status,is_default")
    .eq("user_id", user.id);
  const hasMembership = (memberships || []).some((m) => m.status === "Active");

  const { data: platformUser } = await admin
    .from("platform_users")
    .select("role,status")
    .eq("user_id", user.id)
    .eq("status", "Active")
    .maybeSingle();

  // Domain auto-join for users without any membership.
  let autoJoined: { organization_id: string; role: string } | null = null;
  if (!hasMembership && !platformUser && verifiedEmail) {
    const domain = email.split("@")[1];
    const { data: domainRule } = await admin
      .from("organization_email_domains")
      .select("organization_id,auto_join,auto_join_role,allowed_providers,organization:organizations!organization_id(status)")
      .eq("domain", domain)
      .maybeSingle();

    const org = Array.isArray(domainRule?.organization) ? domainRule?.organization[0] : domainRule?.organization;
    if (domainRule && org?.status === "Active") {
      if (!(domainRule.allowed_providers || []).includes(provider)) {
        return deny("provider_not_allowed", { domain });
      }
      if (domainRule.auto_join && isRole(domainRule.auto_join_role)) {
        let withinLimit = true;
        try {
          const usage = await getOrganizationUserUsage(domainRule.organization_id);
          await requireWithinPlanLimit(domainRule.organization_id, "users", usage.current + 1);
        } catch {
          withinLimit = false;
        }
        if (withinLimit) {
          autoJoined = { organization_id: domainRule.organization_id, role: domainRule.auto_join_role };
        }
      }
    }
  } else if (!hasMembership && !platformUser && !verifiedEmail && !existing) {
    return deny("email_unverified");
  }

  const canEnter = hasMembership || Boolean(platformUser) || Boolean(autoJoined);
  if (canEnter) status = "Active";

  if (!existing && !canEnter && unknownUserPolicy() === "deny") {
    // Remove the orphan Auth account created by this attempt so stray OAuth
    // sign-ins do not accumulate. Only touches accounts created moments ago.
    const createdMs = user.created_at ? Date.parse(user.created_at) : 0;
    if (createdMs && Date.now() - createdMs < 10 * 60 * 1000) {
      await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
    }
    return deny("not_provisioned");
  }

  const directoryValues = {
    email,
    status,
    email_verified_at: user.email_confirmed_at || null,
    last_login_at: now,
    last_login_provider: provider,
    auth_providers: identityProviders(user),
    updated_at: now,
    ...(status === "Active" && existing?.status !== "Active" ? { approved_at: now } : {}),
  };

  if (existing) {
    const { error } = await admin.from("users").update(directoryValues).eq("id", user.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await admin.from("users").insert({
      id: user.id,
      full_name: displayName(user, email),
      job_title: (user.user_metadata?.job_title as string | undefined) || null,
      ...directoryValues,
    });
    if (error) throw new Error(error.message);
  }

  if (autoJoined) {
    const { error } = await admin.from("organization_memberships").upsert(
      {
        organization_id: autoJoined.organization_id,
        user_id: user.id,
        role: autoJoined.role,
        status: "Active",
        is_default: !(memberships || []).some((m) => m.is_default),
      },
      { onConflict: "organization_id,user_id" }
    );
    if (error) throw new Error(error.message);

    await writeAuditLog({
      organizationId: autoJoined.organization_id,
      userId: user.id,
      action: "USER_AUTO_JOINED_BY_DOMAIN",
      entityType: "organization_membership",
      newValues: { email, role: autoJoined.role, provider },
      ipAddress: options.ip,
    });
  }

  if (status === "Pending") {
    await writeAuditLog({
      userId: user.id,
      action: "AUTH_SIGN_IN_PENDING_APPROVAL",
      entityType: "user",
      entityId: user.id,
      newValues: { email, provider },
      ipAddress: options.ip,
    });
    return { status: "pending", userId: user.id };
  }

  // Default organization for the session.
  const { data: defaultMembership } = await admin
    .from("organization_memberships")
    .select("organization_id,role,organization:organizations!organization_id(status)")
    .eq("user_id", user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(5);

  const active = (defaultMembership || []).find((m) => {
    const org = Array.isArray(m.organization) ? m.organization[0] : m.organization;
    return org?.status === "Active";
  });

  // Legacy profile row: several tables still reference user_profiles(id)
  // for owner/reviewer columns, so every active member needs one.
  if (active) {
    await admin.from("user_profiles").upsert(
      {
        id: user.id,
        organization_id: active.organization_id,
        full_name: existing?.full_name || displayName(user, email),
        role: active.role,
        status: "Active",
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
    await admin
      .from("user_profiles")
      .update({ status: "Active" })
      .eq("id", user.id)
      .eq("status", "Invited");
  }

  await writeAuditLog({
    organizationId: active?.organization_id || null,
    userId: user.id,
    action: "AUTH_SIGN_IN",
    entityType: "user",
    entityId: user.id,
    newValues: { provider },
    ipAddress: options.ip,
  });

  return { status: "ok", organizationId: active?.organization_id || null, userId: user.id };
}
