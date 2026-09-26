import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";

const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];

export async function GET() {
  const { user, profile, supabase, error } = await getServerAuthContext();
  if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
  if (!profile?.organization_id) return NextResponse.json({ error: "No active organization is selected." }, { status: 400 });

  const { data, error: queryError } = await supabase.from("activity_categories").select("id,name,description,is_active,created_at,updated_at").eq("organization_id", profile.organization_id).order("name");
  if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function POST(request: Request) {
  const { user, profile, platformRole, supabase, error } = await getServerAuthContext();
  if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
  if (!profile?.organization_id) return NextResponse.json({ error: "No active organization is selected." }, { status: 400 });
  if (platformRole !== "Platform Admin" && !MANAGE_ROLES.includes(profile.role)) return NextResponse.json({ error: "You do not have permission to manage activity categories." }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Category name must be 100 characters or fewer." }, { status: 400 });

  const { data, error: insertError } = await supabase.from("activity_categories").insert({ organization_id: profile.organization_id, name, description: description || null }).select("id,name,description,is_active,created_at,updated_at").single();
  if (insertError) return NextResponse.json({ error: insertError.code === "23505" ? "A category with this name already exists." : insertError.message }, { status: insertError.code === "23505" ? 409 : 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
