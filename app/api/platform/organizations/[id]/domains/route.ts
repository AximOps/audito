import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/authorize";
import { createAdminClient } from "@/lib/admin";
import { writeAuditLog } from "@/lib/audit";
import { PUBLIC_EMAIL_DOMAINS, normalizeDomain, validateDomainSettings } from "@/lib/email-domains";
import { readJson } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

const COLUMNS = "domain,organization_id,auto_join,auto_join_role,allowed_providers,created_at,updated_at";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const { data, error } = await createAdminClient()
    .from("organization_email_domains")
    .select(COLUMNS)
    .eq("organization_id", params.id)
    .order("domain");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domains: data || [] });
}

/** Claim a verified email domain for an organization (Platform Admin only). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await readJson(request);
  const domain = normalizeDomain(body.domain);
  if (!domain) return NextResponse.json({ error: "Enter a valid domain, e.g. example.com." }, { status: 400 });
  if (PUBLIC_EMAIL_DOMAINS.has(domain)) {
    return NextResponse.json({ error: "Public email domains cannot be claimed by an organization." }, { status: 400 });
  }
  if (body.verified !== true) {
    return NextResponse.json(
      { error: "Confirm you have verified that this organization controls the domain." },
      { status: 400 }
    );
  }

  const settings = validateDomainSettings(body);
  if ("error" in settings) return NextResponse.json({ error: settings.error }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_email_domains")
    .insert({ domain, organization_id: params.id, created_by: auth.user!.id, ...settings.values })
    .select(COLUMNS)
    .single();

  if (error) {
    const message = error.code === "23505" ? "This domain is already assigned to an organization." : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAuditLog({
    organizationId: params.id,
    userId: auth.user!.id,
    action: "ORG_EMAIL_DOMAIN_ADDED",
    entityType: "organization_email_domain",
    newValues: data,
  });
  return NextResponse.json({ domain: data }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requirePlatformAdmin();
  if (auth instanceof NextResponse) return auth;

  const domain = normalizeDomain(new URL(request.url).searchParams.get("domain"));
  if (!domain) return NextResponse.json({ error: "Domain is required." }, { status: 400 });

  const { error } = await createAdminClient()
    .from("organization_email_domains")
    .delete()
    .eq("organization_id", params.id)
    .eq("domain", domain);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog({
    organizationId: params.id,
    userId: auth.user!.id,
    action: "ORG_EMAIL_DOMAIN_REMOVED",
    entityType: "organization_email_domain",
    oldValues: { domain },
  });
  return NextResponse.json({ success: true });
}
