import { getServerAuthContext } from "@/lib/server-auth";
import { NextResponse } from "next/server";

const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];

const getContext = getServerAuthContext;

export async function GET() {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("activity_categories")
    .select("id,name,description,is_active,created_at,updated_at")
    .eq("organization_id", profile.organization_id)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data || [] });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!MANAGE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: "You do not have permission to manage activity categories." }, { status: 403 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Category name must be 100 characters or fewer." }, { status: 400 });

  const { data, error } = await supabase
    .from("activity_categories")
    .insert({ organization_id: profile.organization_id, name, description: description || null })
    .select("id,name,description,is_active,created_at,updated_at")
    .single();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ category: data }, { status: 201 });
}
