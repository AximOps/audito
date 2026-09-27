import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { can } from "@/lib/rbac";
import { requireAssetCapacity } from "@/lib/assets-subscription";

const WRITE_ROLES = new Set([
  "Organization Admin",
  "Security Manager",
  "IT Manager",
  "Contributor",
]);

function canWrite(profile: any, platformRole: string | null) {
  return platformRole === "Platform Admin" || WRITE_ROLES.has(profile?.role);
}

export async function GET(request: Request) {
  const auth = await getServerAuthContext();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error || "Unauthorized." }, { status: 401 });
  }
  if (!auth.organization || !auth.profile) {
    return NextResponse.json({ error: "No active organization selected." }, { status: 400 });
  }
  if (!can(auth.profile.role, "assets") && auth.platformRole !== "Platform Admin") {
    return NextResponse.json({ error: "You are not authorized to access assets." }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() || "";
  let query = auth.supabase
    .from("assets")
    .select("id,name,asset_type,hostname,ip_address,environment,criticality,status,description,created_at,updated_at")
    .eq("organization_id", auth.organization.id)
    .order("name", { ascending: true });

  if (search) {
    const safe = search.replace(/[%_,]/g, " ");
    query = query.or(`name.ilike.%${safe}%,asset_type.ilike.%${safe}%,hostname.ilike.%${safe}%,environment.ilike.%${safe}%`);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await getServerAuthContext();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || "Unauthorized." }, { status: 401 });
  if (!auth.organization || !auth.profile) return NextResponse.json({ error: "No active organization selected." }, { status: 400 });
  if (!canWrite(auth.profile, auth.platformRole)) return NextResponse.json({ error: "You are not authorized to create assets." }, { status: 403 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }

  const name = String(body.name || "").trim();
  const assetType = String(body.asset_type || "").trim();
  if (!name || !assetType) return NextResponse.json({ error: "Name and asset type are required." }, { status: 400 });

  try {
    await requireAssetCapacity(auth.supabase, auth.organization.id);
  } catch (error: any) {
    if (error?.code === "PLAN_LIMIT_REACHED") {
      return NextResponse.json({
        error: "Asset subscription limit reached.",
        code: error.code,
        resource: error.resource,
        limit: error.limit,
        current: error.current,
        plan: error.plan,
      }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to validate subscription." }, { status: 500 });
  }

  const { data, error } = await auth.supabase
    .from("assets")
    .insert({
      organization_id: auth.organization.id,
      name,
      asset_type: assetType,
      hostname: body.hostname?.trim() || null,
      ip_address: body.ip_address?.trim() || null,
      environment: body.environment?.trim() || null,
      criticality: body.criticality || null,
      status: body.status || "Active",
      description: body.description?.trim() || null,
    })
    .select("id,name,asset_type,hostname,ip_address,environment,criticality,status,description,created_at,updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ asset: data }, { status: 201 });
}
