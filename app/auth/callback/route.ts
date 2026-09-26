import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/admin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", requestUrl.origin));
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
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {}
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(exchangeError.message)}`, requestUrl.origin)
    );
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=session_error", requestUrl.origin));
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: existingUser } = await admin
    .from("users")
    .select("id,status")
    .eq("id", user.id)
    .maybeSingle();

  if (existingUser?.status === "Disabled") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=account_disabled", requestUrl.origin));
  }

  if (!existingUser) {
    await admin.from("users").insert({
      id: user.id,
      email: (user.email || "").toLowerCase(),
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      job_title: user.user_metadata?.job_title || null,
      status: "Active",
      email_verified_at: user.email_confirmed_at || now,
      last_login_at: now,
    });
  } else {
    await admin
      .from("users")
      .update({
        status: "Active",
        email: (user.email || "").toLowerCase(),
        email_verified_at: user.email_confirmed_at || now,
        last_login_at: now,
        updated_at: now,
      })
      .eq("id", user.id);
  }

  await admin
    .from("organization_memberships")
    .update({ status: "Active", updated_at: now })
    .eq("user_id", user.id)
    .eq("status", "Invited");

  await admin
    .from("user_profiles")
    .update({ status: "Active", last_login_at: now })
    .eq("id", user.id);

  const { data: defaultMembership } = await admin
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const response = NextResponse.redirect(new URL("/dashboard", requestUrl.origin));

  if (defaultMembership?.organization_id) {
    response.cookies.set({
      name: "auditops_active_organization",
      value: defaultMembership.organization_id,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
