import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

const MANAGE_ROLES = ["Organization Admin", "Compliance Manager"];

async function getContext() {
  const cookieStore = cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set({ name, value, ...options })); } catch {}
      },
    },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.from("user_profiles").select("id,organization_id,role,status").eq("id", user.id).maybeSingle();
  return { supabase, user, profile };
}

export async function GET() {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data, error } = await supabase.from("activity_task_types").select("id,name,description,is_active,created_at,updated_at").eq("organization_id", profile.organization_id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ taskTypes: data || [] });
}

export async function POST(request: Request) {
  const { supabase, user, profile } = await getContext();
  if (!user || !profile || profile.status !== "Active") return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!MANAGE_ROLES.includes(profile.role)) return NextResponse.json({ error: "You do not have permission to manage task types." }, { status: 403 });
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!name) return NextResponse.json({ error: "Task type name is required." }, { status: 400 });
  if (name.length > 100) return NextResponse.json({ error: "Task type name must be 100 characters or fewer." }, { status: 400 });
  const { data, error } = await supabase.from("activity_task_types").insert({ organization_id: profile.organization_id, name, description: description || null }).select("id,name,description,is_active").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "A task type with this name already exists." : error.message }, { status: 400 });
  return NextResponse.json({ taskType: data }, { status: 201 });
}
