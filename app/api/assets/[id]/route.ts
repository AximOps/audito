import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";

const WRITE_ROLES = new Set([
  "Organization Admin",
  "Security Manager",
  "IT Manager",
  "Contributor",
]);

function canWrite(profile: any, platformRole: string | null) {
  return platformRole === "Platform Admin" || WRITE_ROLES.has(profile?.role);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || "Unauthorized." }, { status: 401 });
  if (!auth.organization || !auth.profile) return NextResponse.json({ error: "No active organization selected." }, { status: 400 });
  if (!canWrite(auth.profile, auth.platformRole)) return NextResponse.json({ error: "You are not authorized to edit assets." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const update: Record<string, any> = {};
  for (const key of ["name", "asset_type", "hostname", "ip_address", "environment", "criticality", "status", "description"]) {
    if (key in body) update[key] = typeof body[key] === "string" ? body[key].trim() || null : body[key];
  }
  if (update.name === null || update.asset_type === null) {
    return NextResponse.json({ error: "Name and asset type cannot be empty." }, { status: 400 });
  }

  const { data: existing, error: existingError } = await auth.supabase
    .from("assets")
    .select("id,status")
    .eq("id", params.id)
    .eq("organization_id", auth.organization.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Asset not found." }, { status: 404 });

  const wasCapacity = existing.status !== "Retired";
  const willCapacity = (update.status ?? existing.status) !== "Retired";
  if (!wasCapacity && willCapacity) {
    const { count, error: countError } = await auth.supabase
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organization.id)
      .in("status", ["Active", "Inactive"]);
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    const { getOrganizationSubscription } = await import("@/lib/subscription");
    const plan = await getOrganizationSubscription(auth.organization.id);
    if (plan.limits.assets !== null && (count ?? 0) >= plan.limits.assets) {
      return NextResponse.json({
        error: "Asset subscription limit reached.",
        code: "PLAN_LIMIT_REACHED",
        resource: "assets",
        limit: plan.limits.assets,
        current: count ?? 0,
        plan: plan.code,
      }, { status: 409 });
    }
  }

  const { data, error } = await auth.supabase
    .from("assets")
    .update(update)
    .eq("id", params.id)
    .eq("organization_id", auth.organization.id)
    .select("id,name,asset_type,hostname,ip_address,environment,criticality,status,description,created_at,updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await getServerAuthContext();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || "Unauthorized." }, { status: 401 });
  if (!auth.organization || !auth.profile) return NextResponse.json({ error: "No active organization selected." }, { status: 400 });
  if (!canWrite(auth.profile, auth.platformRole)) return NextResponse.json({ error: "You are not authorized to remove assets." }, { status: 403 });

  const { error } = await auth.supabase
    .from("assets")
    .update({ status: "Retired" })
    .eq("id", params.id)
    .eq("organization_id", auth.organization.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
