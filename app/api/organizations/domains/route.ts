import { NextResponse } from "next/server";
import { requireAccess } from "@/lib/authorize";
import { createAdminClient } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { normalizeDomain, validateDomainSettings } from "@/lib/email-domains";
import { readJson } from "@/lib/auth-session";
import { authMethods } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

const COLUMNS = "domain,auto_join,auto_join_role,allowed_providers,updated_at";

/** Organization Admin view of the current organization's sign-in settings. */
export async function GET() {
  const auth = await requireAccess("authSettings", "read");
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await auth.supabase
    .from("organization_email_domains")
    .select(COLUMNS)
    .eq("organization_id", auth.profile.organization_id)
    .order("domain");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    domains: data || [],
    methods: { email: authMethods.email, google: authMethods.google, azure: authMethods.azure, signup: authMethods.signup },
  });
}

/**
 * Organization Admins tune auto-join for domains a Platform Admin assigned
 * to their organization. They cannot add or move domains.
 */
export async function PATCH(request: Request) {
  const auth = await requireAccess("authSettings", "update");
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  const domain = normalizeDomain(body.domain);
  if (!domain) return NextResponse.json({ error: "Domain is required." }, { status: 400 });

  const settings = validateDomainSettings(body);
  if ("error" in settings) return NextResponse.json({ error: settings.error }, { status: 400 });
  if (Object.keys(settings.values).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await createAdminClient()
    .from("organization_email_domains")
    .update({ ...settings.values, updated_at: new Date().toISOString() })
    .eq("domain", domain)
    .eq("organization_id", auth.profile.organization_id)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Domain not found for this organization." }, { status: 404 });

  await writeAuditLog({
    organizationId: auth.profile.organization_id,
    userId: auth.user.id,
    action: "ORG_EMAIL_DOMAIN_UPDATED",
    entityType: "organization_email_domain",
    newValues: data,
  });
  return NextResponse.json({ domain: data });
}
