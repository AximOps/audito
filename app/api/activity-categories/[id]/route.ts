import { getServerAuthContext } from "@/lib/server-auth";
import { NextResponse } from "next/server";

const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];

const getContext = getServerAuthContext;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!MANAGE_ROLES.includes(profile.role)) return NextResponse.json({ error: "You do not have permission to manage activity categories." }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const isActive = typeof body.is_active === "boolean" ? body.is_active : undefined;
  if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Category name must be 100 characters or fewer." }, { status: 400 });

  const update: Record<string, unknown> = { name, description: description || null, updated_at: new Date().toISOString() };
  if (isActive !== undefined) update.is_active = isActive;

  const { data, error } = await supabase
    .from("activity_categories")
    .update(update)
    .eq("id", params.id)
    .eq("organization_id", profile.organization_id)
    .select("id,name,description,is_active,created_at,updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "A category with this name already exists." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Category not found." }, { status: 404 });
  return NextResponse.json({ category: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role !== "Organization Admin") return NextResponse.json({ error: "Only Organization Admins can delete categories." }, { status: 403 });

  const { error } = await supabase
    .from("activity_categories")
    .delete()
    .eq("id", params.id)
    .eq("organization_id", profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
