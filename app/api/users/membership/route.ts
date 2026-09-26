import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: Request) {
  try {
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
            cookiesToSet: Array<{
              name: string;
              value: string;
              options?: {
                domain?: string;
                expires?: Date;
                httpOnly?: boolean;
                maxAge?: number;
                path?: string;
                sameSite?: "lax" | "strict" | "none" | boolean;
                secure?: boolean;
              };
            }>
          ) {
            try {
              cookiesToSet.forEach(({ name, value, options }) => {
                cookieStore.set(name, value, options);
              });
            } catch {
              // Server Component / route context may not allow
              // cookie mutation in every execution path.
            }
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const organizationId = body?.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select(
        `
        id,
        organization_id,
        user_id,
        role,
        status,
        is_default,
        organizations (
          id,
          name,
          slug,
          status,
          plan
        )
      `
      )
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("status", "Active")
      .maybeSingle();

    if (membershipError) {
      console.error(
        "Failed to retrieve organization membership:",
        membershipError
      );

      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            "You do not have an active membership in this organization.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      membership,
    });
  } catch (error) {
    console.error("Membership API error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}