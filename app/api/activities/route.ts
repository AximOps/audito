import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const WRITE_ROLES = [
  "Organization Admin",
  "Compliance Manager",
  "Contributor",
];

const DELETE_ROLES = [
  "Organization Admin",
  "Compliance Manager",
];

const STATUSES = [
  "Not Started",
  "In Progress",
  "Pending Review",
  "Completed",
  "Overdue",
  "Cancelled",
];

const PRIORITIES = ["Critical", "High", "Medium", "Low"];

async function getContext() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            );
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { supabase, user: null, profile: null, error: "Unauthorized." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,organization_id,full_name,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      supabase,
      user,
      profile: null,
      error: "Your AuditOps user profile could not be found.",
    };
  }

  if (profile.status !== "Active") {
    return {
      supabase,
      user,
      profile,
      error: "Your AuditOps account is not active.",
    };
  }

  return { supabase, user, profile, error: null };
}

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function writeAuditLog(
  organizationId: string,
  userId: string,
  action: string,
  entityId: string,
  values: Record<string, unknown>
) {
  const admin = adminClient();
  await admin.from("audit_logs").insert({
    organization_id: organizationId,
    user_id: userId,
    action,
    entity_type: "compliance_activity",
    entity_id: entityId,
    new_values: values,
  });
}

export async function POST(request: Request) {
  try {
    const { user, profile, error } = await getContext();

    if (!user || !profile) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: "Your role cannot create compliance activities." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json(
        { error: "Activity title is required." },
        { status: 400 }
      );
    }

    const status = body.status || "Not Started";
    const priority = body.priority || "Medium";

    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid activity status." }, { status: 400 });
    }

    if (!PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "Invalid activity priority." }, { status: 400 });
    }

    const admin = adminClient();

    const assigneeIds = [body.owner_id, body.reviewer_id].filter(Boolean);
    if (assigneeIds.length > 0) {
      const { data: assignees, error: assigneeError } = await admin
        .from("user_profiles")
        .select("id")
        .eq("organization_id", profile.organization_id)
        .in("id", assigneeIds);

      if (assigneeError || (assignees || []).length !== assigneeIds.length) {
        return NextResponse.json(
          { error: "Owner or reviewer must belong to the current organization." },
          { status: 400 }
        );
      }
    }

    const payload = {
      organization_id: profile.organization_id,
      title,
      description:
        typeof body.description === "string" ? body.description.trim() || null : null,
      category:
        typeof body.category === "string" && body.category.trim()
          ? body.category.trim()
          : "Compliance",
      owner_id: body.owner_id || null,
      reviewer_id: body.reviewer_id || null,
      frequency: body.frequency || null,
      status,
      priority,
      start_date: body.start_date || null,
      due_date: body.due_date || null,
    };

    const { data, error: insertError } = await admin
      .from("compliance_activities")
      .insert(payload)
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    await writeAuditLog(
      profile.organization_id,
      user.id,
      "ACTIVITY_CREATED",
      data.id,
      payload
    );

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    console.error("Create activity failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
