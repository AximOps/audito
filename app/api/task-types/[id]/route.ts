import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";

const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { user, profile, platformRole, supabase, error } = await getServerAuthContext();
  if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
  if (!profile?.organization_id) return NextResponse.json({ error: "No active organization is selected." }, { status: 400 });
  if (platformRole !== "Platform Admin" && !MANAGE_ROLES.includes(profile.role)) return NextResponse.json({ error: "You do not have permission to manage task types." }, { status: 403 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return NextResponse.json({ error: "Task type name is required." }, { status: 400 });

  const { data, error: updateError } = await supabase
    .from("activity_task_types")
    .update({ name, description: description || null, is_active: typeof body.is_active === "boolean" ? body.is_active : true, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("organization_id", profile.organization_id)
    .select("id,name,description,is_active")
    .maybeSingle();

  if (updateError) return NextResponse.json({ error: updateError.code === "23505" ? "A task type with this name already exists." : updateError.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: "Task type not found." }, { status: 404 });
  return NextResponse.json({ taskType: data });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { user, profile, platformRole, supabase, error } = await getServerAuthContext();
  if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
  if (!profile?.organization_id) return NextResponse.json({ error: "No active organization is selected." }, { status: 400 });
  if (platformRole !== "Platform Admin" && profile.role !== "Organization Admin") return NextResponse.json({ error: "Only Organization Admins can delete task types." }, { status: 403 });

  const { error: deleteError } = await supabase.from("activity_task_types").delete().eq("id", params.id).eq("organization_id", profile.organization_id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
