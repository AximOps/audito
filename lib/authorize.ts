import "server-only";
import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { canDo, type Action, type Permission } from "@/lib/rbac";

export type AuthContext = Awaited<ReturnType<typeof getServerAuthContext>>;
export type OrgAuthContext = AuthContext & {
  user: NonNullable<AuthContext["user"]>;
  profile: NonNullable<AuthContext["profile"]> & { organization_id: string; role: string };
};

/**
 * API guard: authenticated, active, inside an active organization, and the
 * membership role is allowed `action` on `permission` (lib/rbac.ts).
 *
 *   const auth = await requireAccess("assets", "create");
 *   if (auth instanceof NextResponse) return auth;
 *
 * Platform Admins get no implicit bypass here: tenant data is written with
 * the user's own Supabase client, and RLS evaluates the membership role.
 * Platform administration uses the /api/platform routes instead.
 */
export async function requireAccess(
  permission: Permission,
  action: Action = "read"
): Promise<OrgAuthContext | NextResponse> {
  const ctx = await getServerAuthContext();

  if (!ctx.user) {
    return NextResponse.json({ error: ctx.error || "Unauthorized." }, { status: 401 });
  }
  if (ctx.error || !ctx.profile) {
    return NextResponse.json({ error: ctx.error || "Access denied." }, { status: 403 });
  }
  if (!ctx.profile.organization_id || !ctx.profile.role) {
    return NextResponse.json({ error: "No active organization is selected." }, { status: 400 });
  }
  if (!canDo(ctx.profile.role, permission, action)) {
    return NextResponse.json(
      { error: `Your role (${ctx.profile.role}) cannot ${action} ${permission}.` },
      { status: 403 }
    );
  }
  return ctx as OrgAuthContext;
}

export async function requirePlatformAdmin(): Promise<AuthContext | NextResponse> {
  const ctx = await getServerAuthContext();
  if (!ctx.user) return NextResponse.json({ error: ctx.error || "Unauthorized." }, { status: 401 });
  if (ctx.platformRole !== "Platform Admin") {
    return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });
  }
  return ctx;
}
