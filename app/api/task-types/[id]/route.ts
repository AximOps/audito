import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];
async function getContext() {
  const cookieStore = cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {
    getAll() { return cookieStore.getAll(); },
    setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options })); } catch {} },
  }});
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("user_profiles").select("id,organization_id,role,status").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
}
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!MANAGE_ROLES.includes(profile.role)) return NextResponse.json({ error: "You do not have permission to manage task types." }, { status: 403 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return NextResponse.json({ error: "Task type name is required." }, { status: 400 });
  const { data, error } = await supabase.from("activity_task_types").update({ name, description: description || null, is_active: Boolean(body.is_active), updated_at: new Date().toISOString() }).eq("id", params.id).eq("organization_id", profile.organization_id).select("id,name,description,is_active").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A task type with this name already exists." : error.message }, { status: 400 });
  return NextResponse.json({ taskType: data });
}
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (profile.role !== "Organization Admin") return NextResponse.json({ error: "Only Organization Admin can delete task types." }, { status: 403 });
  const { error } = await supabase.from("activity_task_types").delete().eq("id", params.id).eq("organization_id", profile.organization_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
