import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";
import {
  ORGANIZATION_SUBSCRIPTIONS,
  ORGANIZATION_STATUSES,
} from "@/lib/organization-plans";

const SELECT_FIELDS =
  "id,name,slug,status,subscription,timezone,industry,plan,created_at,updated_at,removed_at";

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function requirePlatformAdmin() {
  const { user, platformRole, error } = await getServerAuthContext();

  if (!user) {
    return { user: null, error: error || "Unauthorized." };
  }

  if (platformRole !== "Platform Admin") {
    return { user: null, error: "Platform Admin access required." };
  }

  return { user, error: null };
}

export async function GET() {
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
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ organizations: data || [] });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to load organizations.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error },
        { status: auth.error === "Unauthorized." ? 401 : 403 }
      );
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? normalizeSlug(body.slug)
        : normalizeSlug(name);
    const subscription = body.subscription || "FREE";
    const timezone =
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "Asia/Kolkata";
    const industry =
      typeof body.industry === "string" && body.industry.trim()
        ? body.industry.trim()
        : null;

    if (!name) {
      return NextResponse.json(
        { error: "Organization name is required." },
        { status: 400 }
      );
    }

    if (!slug) {
      return NextResponse.json(
        { error: "Organization slug is required." },
        { status: 400 }
      );
    }

    if (!ORGANIZATION_SUBSCRIPTIONS.includes(subscription)) {
      return NextResponse.json(
        { error: "Invalid subscription plan." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name,
        slug,
        status: "Active",
        subscription,
        plan: subscription,
        timezone,
        industry,
      })
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "An organization with this slug already exists."
              : error.message,
        },
        { status: 400 }
      );
    }

    await admin.from("audit_logs").insert({
      organization_id: data.id,
      user_id: auth.user.id,
      action: "ORGANIZATION_CREATED",
      entity_type: "organization",
      entity_id: data.id,
      new_values: {
        name,
        slug,
        subscription,
        timezone,
        industry,
      },
    });

    return NextResponse.json({ organization: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to create organization.",
      },
      { status: 500 }
    );
  }
}
