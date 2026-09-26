import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";
import {
  ORGANIZATION_SUBSCRIPTIONS,
  ORGANIZATION_STATUSES,
} from "@/lib/organization-plans";

const SELECT_FIELDS =
  "id,name,slug,status,subscription,timezone,industry,plan,created_at,updated_at,removed_at";

async function requirePlatformAdmin() {
  const { user, platformRole, error } = await getServerAuthContext();

  if (!user) return { user: null, error: error || "Unauthorized." };
  if (platformRole !== "Platform Admin") {
    return { user: null, error: "Platform Admin access required." };
  }

  return { user, error: null };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === "Unauthorized." ? 401 : 403 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select(SELECT_FIELDS)
      .eq("id", params.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    return NextResponse.json({ organization: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to load organization." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === "Unauthorized." ? 401 : 403 }
      );
    }

    const admin = createAdminClient();
    const { data: before, error: beforeError } = await admin
      .from("organizations")
      .select(SELECT_FIELDS)
      .eq("id", params.id)
      .maybeSingle();

    if (beforeError) return NextResponse.json({ error: beforeError.message }, { status: 500 });
    if (!before) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
      }
      updates.name = body.name.trim();
    }

    if (body.slug !== undefined) {
      if (typeof body.slug !== "string" || !body.slug.trim()) {
        return NextResponse.json({ error: "Organization slug is required." }, { status: 400 });
      }
      updates.slug = body.slug.trim().toLowerCase();
    }

    if (body.subscription !== undefined) {
      if (!ORGANIZATION_SUBSCRIPTIONS.includes(body.subscription)) {
        return NextResponse.json({ error: "Invalid subscription plan." }, { status: 400 });
      }
      updates.subscription = body.subscription;
      updates.plan = body.subscription;
    }

    if (body.timezone !== undefined) {
      if (typeof body.timezone !== "string" || !body.timezone.trim()) {
        return NextResponse.json({ error: "Timezone is required." }, { status: 400 });
      }
      updates.timezone = body.timezone.trim();
    }

    if (body.industry !== undefined) {
      updates.industry =
        typeof body.industry === "string" && body.industry.trim()
          ? body.industry.trim()
          : null;
    }

    if (body.status !== undefined) {
      if (!ORGANIZATION_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "Invalid organization status." }, { status: 400 });
      }
      updates.status = body.status;
      updates.removed_at = body.status === "Removed" ? new Date().toISOString() : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
    }

    const { data: after, error: updateError } = await admin
      .from("organizations")
      .update(updates)
      .eq("id", params.id)
      .select(SELECT_FIELDS)
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error:
            updateError.code === "23505"
              ? "An organization with this slug already exists."
              : updateError.message,
        },
        { status: 400 }
      );
    }

    let action = "ORGANIZATION_UPDATED";
    if (before.status !== after.status) {
      if (after.status === "Suspended") action = "ORGANIZATION_SUSPENDED";
      else if (after.status === "Active") action = "ORGANIZATION_REACTIVATED";
      else if (after.status === "Removed") action = "ORGANIZATION_REMOVED";
    } else if (before.subscription !== after.subscription) {
      action = "ORGANIZATION_SUBSCRIPTION_CHANGED";
    }

    await admin.from("audit_logs").insert({
      organization_id: after.id,
      user_id: auth.user.id,
      action,
      entity_type: "organization",
      entity_id: after.id,
      old_values: before,
      new_values: after,
    });

    return NextResponse.json({ organization: after });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to update organization." },
      { status: 500 }
    );
  }
}
