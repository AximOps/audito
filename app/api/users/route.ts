import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";

const ROLES = [
  "Organization Admin",
  "Compliance Manager",
  "Security Manager",
  "IT Manager",
  "Contributor",
  "Auditor / Read Only",
] as const;

function validRole(value: unknown): value is (typeof ROLES)[number] {
  return typeof value === "string" && ROLES.includes(value as (typeof ROLES)[number]);
}

export async function GET() {
  try {
    const { user, profile, platformRole, error } = await getServerAuthContext();

    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (!platformRole && profile?.role !== "Organization Admin") {
      return NextResponse.json({ error: "Only administrators can view users." }, { status: 403 });
    }

    const organizationId = profile?.organization_id;
    if (!organizationId && !platformRole) {
      return NextResponse.json({ error: "No organization is selected." }, { status: 400 });
    }

    const admin = createAdminClient();
    let query = admin
      .from("organization_memberships")
      .select(
        "id,user_id,organization_id,role,status,is_default,created_at,user:users!user_id(id,email,full_name,job_title,status,last_login_at,created_at)"
      )
      .order("created_at", { ascending: true });

    if (organizationId) query = query.eq("organization_id", organizationId);

    const { data, error: queryError } = await query;
    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });

    return NextResponse.json({ users: data || [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load users." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile, platformRole, error } = await getServerAuthContext();

    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const action = body?.action === "add_existing" ? "add_existing" : "invite";
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId
        ? body.organizationId
        : profile?.organization_id;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    }

    if (!platformRole && profile?.role !== "Organization Admin") {
      return NextResponse.json({ error: "Only administrators can manage users." }, { status: 403 });
    }

    if (!platformRole && profile?.organization_id !== organizationId) {
      return NextResponse.json({ error: "You cannot manage users in another organization." }, { status: 403 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
    const role = typeof body.role === "string" ? body.role.trim() : "Contributor";

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!validRole(role)) return NextResponse.json({ error: "Invalid organization role." }, { status: 400 });
    if (email === (user.email || "").toLowerCase()) {
      return NextResponse.json({ error: "You cannot add yourself." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: existingUser, error: lookupError } = await admin
      .from("users")
      .select("id,email,full_name,job_title,status")
      .ilike("email", email)
      .maybeSingle();

    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 });

    if (existingUser || action === "add_existing") {
      if (!existingUser) {
        return NextResponse.json(
          { error: "No existing AuditOps user was found with this email address." },
          { status: 404 }
        );
      }

      if (existingUser.status === "Disabled" || existingUser.status === "Suspended") {
        return NextResponse.json(
          { error: "This AuditOps user is not active and cannot be added to the organization." },
          { status: 400 }
        );
      }

      const { data: existingMembership } = await admin
        .from("organization_memberships")
        .select("id,status,role")
        .eq("organization_id", organizationId)
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          { error: "This user already has a membership in this organization." },
          { status: 409 }
        );
      }

      const { data: membership, error: membershipError } = await admin
        .from("organization_memberships")
        .insert({
          organization_id: organizationId,
          user_id: existingUser.id,
          role,
          status: "Active",
          is_default: false,
        })
        .select("id,user_id,organization_id,role,status,is_default")
        .single();

      if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });

      await admin.from("audit_logs").insert({
        organization_id: organizationId,
        user_id: user.id,
        action: "USER_ADDED_TO_ORGANIZATION",
        entity_type: "organization_membership",
        entity_id: membership.id,
        new_values: { email, role },
      });

      return NextResponse.json({ success: true, membership, message: `${email} was added to the organization.` });
    }

    if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
      data: { full_name: fullName, job_title: jobTitle, organization_id: organizationId, role },
    });

    if (inviteError || !invited.user) {
      return NextResponse.json(
        { error: inviteError?.message || "Unable to create the invitation." },
        { status: 400 }
      );
    }

    const newUserId = invited.user.id;

    const { error: userInsertError } = await admin.from("users").insert({
      id: newUserId,
      email,
      full_name: fullName,
      job_title: jobTitle || null,
      status: "Invited",
    });

    if (userInsertError) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: userInsertError.message }, { status: 500 });
    }

    const { error: membershipError } = await admin.from("organization_memberships").insert({
      organization_id: organizationId,
      user_id: newUserId,
      role,
      status: "Invited",
      is_default: true,
    });

    if (membershipError) {
      await admin.from("users").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    // Compatibility record for existing AuditOps code. New authorization uses users + memberships.
    await admin.from("user_profiles").upsert({
      id: newUserId,
      organization_id: organizationId,
      full_name: fullName,
      job_title: jobTitle || null,
      role,
      status: "Invited",
    }, { onConflict: "id" });

    await admin.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: user.id,
      action: "USER_INVITED",
      entity_type: "user",
      entity_id: newUserId,
      new_values: { email, full_name: fullName, job_title: jobTitle || null, role },
    });

    return NextResponse.json(
      { success: true, userId: newUserId, message: `Invitation sent to ${email}.` },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to manage user." },
      { status: 500 }
    );
  }
}
