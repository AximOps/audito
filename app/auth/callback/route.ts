import { NextResponse } from "next/server";
import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(
  request: Request
) {
  const requestUrl = new URL(request.url);

  const code =
    requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL("/login?error=missing_code", requestUrl.origin)
    );
  }

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
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set({
                  name,
                  value,
                  ...options,
                });
              }
            );
          } catch {
            // Ignore cookie errors where cookies
            // cannot be modified in this context.
          }
        },
      },
    }
  );

  /*
   * Exchange invitation code for a Supabase session.
   */
  const {
    error: exchangeError,
  } =
    await supabase.auth.exchangeCodeForSession(
      code
    );

  if (exchangeError) {
    console.error(
      "Auth callback error:",
      exchangeError
    );

    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          exchangeError.message
        )}`,
        requestUrl.origin
      )
    );
  }

  /*
   * Get authenticated user.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      new URL(
        "/login?error=session_error",
        requestUrl.origin
      )
    );
  }

  /*
   * Retrieve the user's AuditOps profile and memberships.
   */
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, organization_id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    const now = new Date().toISOString();

    if (profile.status === "Invited") {
      await supabase
        .from("user_profiles")
        .update({
          status: "Active",
          last_login_at: now,
        })
        .eq("id", user.id);
    } else {
      await supabase
        .from("user_profiles")
        .update({ last_login_at: now })
        .eq("id", user.id);
    }

    await supabase
      .from("organization_memberships")
      .update({
        status: "Active",
        updated_at: now,
      })
      .eq("user_id", user.id)
      .eq("status", "Invited");

    const { data: defaultMembership } = await supabase
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "Active")
      .eq("is_default", true)
      .maybeSingle();

    if (defaultMembership?.organization_id) {
      const response = NextResponse.redirect(
        new URL("/dashboard", requestUrl.origin)
      );

      response.cookies.set({
        name: "auditops_active_organization",
        value: defaultMembership.organization_id,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });

      return response;
    }

    return NextResponse.redirect(
      new URL("/dashboard", requestUrl.origin)
    );
  }

  /*
   * ---------------------------------------------------------
   * Fallback for users who were created outside the
   * AuditOps invitation workflow.
   * ---------------------------------------------------------
   *
   * We intentionally DO NOT automatically create an
   * organization membership here.
   *
   * An organization must be assigned by an admin.
   */

  return NextResponse.redirect(
    new URL(
      "/login?error=no_organization",
      requestUrl.origin
    )
  );
}