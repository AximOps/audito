import { getServerAuthContext } from "@/lib/server-auth";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

const getContext = getServerAuthContext;

function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, profile, error } = await getContext();

    if (!user || !profile) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: "Your role cannot edit compliance activities." },
        { status: 403 }
      );
    }

    const admin = adminClient();

    const { data: existing, error: existingError } = await admin
      .from("compliance_activities")
      .select("*")
      .eq("id", params.id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Activity not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : existing.title;
    const status = body.status ?? existing.status;
    const priority = body.priority ?? existing.priority;

    if (!STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid activity status." }, { status: 400 });
    }

    if (!PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "Invalid activity priority." }, { status: 400 });
    }

    const ownerId = body.owner_id ?? null;
    const reviewerId = body.reviewer_id ?? null;
    const assigneeIds = [ownerId, reviewerId].filter(Boolean);

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

    const update = {
      title,
      description:
        typeof body.description === "string"
          ? body.description.trim() || null
          : existing.description,
      category: body.category ?? existing.category,
      owner_id: ownerId,
      reviewer_id: reviewerId,
      frequency: body.frequency ?? null,
      status,
      priority,
      start_date: body.start_date ?? null,
      due_date: body.due_date ?? null,
      updated_at: new Date().toISOString(),
      completed_at:
        status === "Completed"
          ? new Date().toISOString()
          : status !== "Completed"
            ? null
            : existing.completed_at,
    };

    if (!title) {
      return NextResponse.json(
        { error: "Activity title is required." },
        { status: 400 }
      );
    }

    const { error: updateError } = await admin
      .from("compliance_activities")
      .update(update)
      .eq("id", params.id)
      .eq("organization_id", profile.organization_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    await admin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: "ACTIVITY_UPDATED",
      entity_type: "compliance_activity",
      entity_id: params.id,
      old_values: {
        title: existing.title,
        status: existing.status,
        priority: existing.priority,
        owner_id: existing.owner_id,
        due_date: existing.due_date,
      },
      new_values: update,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Update activity failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { user, profile, error } = await getContext();

    if (!user || !profile) {
      return NextResponse.json({ error }, { status: 401 });
    }

    if (!DELETE_ROLES.includes(profile.role)) {
      return NextResponse.json(
        { error: "Your role cannot delete compliance activities." },
        { status: 403 }
      );
    }

    const admin = adminClient();

    const { data: existing, error: existingError } = await admin
      .from("compliance_activities")
      .select("id,title,status,priority,owner_id,due_date,organization_id")
      .eq("id", params.id)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json(
        { error: "Activity not found." },
        { status: 404 }
      );
    }

    const { error: deleteError } = await admin
      .from("compliance_activities")
      .delete()
      .eq("id", params.id)
      .eq("organization_id", profile.organization_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    await admin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: "ACTIVITY_DELETED",
      entity_type: "compliance_activity",
      entity_id: params.id,
      old_values: existing,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete activity failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unexpected server error." },
      { status: 500 }
    );
  }
}
