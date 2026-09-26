import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Route handlers may already have a writable cookie context.
          }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getServerClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId =
      request.headers.get("x-organization-id") ||
      request.headers.get("X-Organization-Id");

    if (!organizationId) {
      return NextResponse.json(
        { error: "No active organization was supplied." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const email = String(body.email || "").trim();
    const role = String(body.role || "Contributor");
    const status = String(body.status || "Active");

    if (!email) {
      return NextResponse.json(
        { error: "User email is required." },
        { status: 400 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role,status")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "Active")
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      );
    }

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("role,status")
      .eq("user_id", user.id)
      .eq("role", "Platform Admin")
      .eq("status", "Active")
      .maybeSingle();

    if (
      !platformUser &&
      (!membership || membership.role !== "Organization Admin")
    ) {
      return NextResponse.json(
        { error: "Only an Organization Admin can manage members." },
        { status: 403 }
      );
    }

    // This route intentionally uses the database function for the email -> Auth
    // user lookup. The function validates the caller again using auth.uid().
    const { data, error } = await supabase.rpc(
      "add_organization_member_by_email",
      {
        target_org: organizationId,
        target_email: email,
        target_role: role,
        target_status: status,
      }
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ membership: data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
