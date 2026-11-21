import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { can, routeRuleFor } from "@/lib/rbac";

const ACTIVE_ORG_COOKIE = "auditops_active_organization";

// Reachable without a session.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/auth/callback",
  "/auth/confirm",
  "/auth/complete",
  "/auth/reset-password",
  "/api/auth",
];

// Signed-in but not necessarily provisioned (no directory/role checks).
const SESSION_ONLY_PREFIXES = ["/auth/pending", "/access-denied"];

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type AccessContext = {
  authenticated: boolean;
  user_status: string | null;
  platform_role: string | null;
  organization_id: string | null;
  role: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getUser() validates the JWT with Supabase Auth and refreshes the session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // Redirect / JSON while keeping any refreshed or cleared auth cookies.
  const finish = (target: NextResponse) => {
    response.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
    return target;
  };
  const redirectTo = (path: string) => finish(NextResponse.redirect(new URL(path, request.url)));
  const deny = (status: number, error: string, path: string) =>
    isApi ? finish(NextResponse.json({ error }, { status })) : redirectTo(path);

  if (matches(pathname, PUBLIC_PREFIXES)) {
    if (user && (pathname === "/login" || pathname === "/signup")) return redirectTo("/dashboard");
    return response;
  }

  if (!user) {
    return deny(401, "Unauthorized.", `/login?next=${encodeURIComponent(pathname + search)}`);
  }

  if (matches(pathname, SESSION_ONLY_PREFIXES)) return response;

  const requestedOrg = request.cookies.get(ACTIVE_ORG_COOKIE)?.value;
  const { data, error } = await supabase.rpc("get_access_context", {
    requested_org: requestedOrg && UUID.test(requestedOrg) ? requestedOrg : null,
  });

  if (error) {
    // Migration 009 not applied yet: fall back to page/API/RLS enforcement.
    console.error("get_access_context failed:", error.message);
    return response;
  }

  const ctx = data as AccessContext;

  switch (ctx.user_status) {
    case "Active":
      break;
    case "Pending":
      return deny(403, "Your account is awaiting approval.", "/auth/pending");
    case "Invited":
      // Session exists but sign-in was not finalized (e.g. direct Supabase call).
      return deny(403, "Sign-in not completed.", "/auth/complete");
    case "Suspended":
      await supabase.auth.signOut();
      return deny(403, "Your account is suspended.", "/login?error=account_suspended");
    case "Disabled":
      await supabase.auth.signOut();
      return deny(403, "Your account is disabled.", "/login?error=account_disabled");
    default:
      await supabase.auth.signOut();
      return deny(403, "No AuditOps access for this account.", "/login?error=not_provisioned");
  }

  const isPlatformAdmin = ctx.platform_role === "Platform Admin";
  const rule = routeRuleFor(pathname);

  if (rule?.platform) {
    return isPlatformAdmin ? response : deny(403, "Platform Admin access required.", "/access-denied");
  }

  if (!ctx.organization_id) {
    if (isPlatformAdmin) {
      return isApi || pathname.startsWith("/platform") ? response : redirectTo("/platform/organizations");
    }
    return deny(403, "You are not a member of any active organization.", "/auth/pending");
  }

  // Keep the org cookie aligned with what the database resolved.
  if (requestedOrg !== ctx.organization_id) {
    response.cookies.set({
      name: ACTIVE_ORG_COOKIE,
      value: ctx.organization_id,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  // API routes check action-level permissions themselves; middleware gates pages.
  if (!isApi && rule?.permission && !can(ctx.role, rule.permission)) {
    return redirectTo("/access-denied");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt)$).*)",
  ],
};
