import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";

async function requirePlatformAdmin() {
  const context = await getServerAuthContext();
  if (!context.user) return { error: context.error || "Unauthorized.", status: 401 as const };
  if (context.platformRole !== "Platform Admin") return { error: "Platform Admin access required.", status: 403 as const };
  return { context };
}

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = createAdminClient();
    const [{ data: users, error: usersError }, { data: memberships, error: membershipsError }, { data: platformUsers, error: platformError }] = await Promise.all([
      admin.from("users").select("id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at,updated_at").order("created_at", { ascending: true }),
      admin.from("organization_memberships").select("user_id,organization_id,role,status,organization:organizations!organization_id(id,name,slug,status)").order("created_at", { ascending: true }),
      admin.from("platform_users").select("user_id,role,status"),
    ]);

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
    if (membershipsError) return NextResponse.json({ error: membershipsError.message }, { status: 500 });
    if (platformError) return NextResponse.json({ error: platformError.message }, { status: 500 });

    const membershipMap = new Map<string, any[]>();
    for (const membership of memberships || []) {
      const list = membershipMap.get(membership.user_id) || [];
      list.push(membership);
      membershipMap.set(membership.user_id, list);
    }
    const platformMap = new Map<string, any>();
    for (const platformUser of platformUsers || []) platformMap.set(platformUser.user_id, platformUser);

    const result = (users || []).map((user) => ({
      ...user,
      organizations: (membershipMap.get(user.id) || []).map((membership) => ({
        id: membership.organization_id,
        name: Array.isArray(membership.organization) ? membership.organization[0]?.name : membership.organization?.name,
        slug: Array.isArray(membership.organization) ? membership.organization[0]?.slug : membership.organization?.slug,
        status: membership.status,
        role: membership.role,
      })),
      platformRole: platformMap.get(user.id)?.role || null,
      platformStatus: platformMap.get(user.id)?.status || null,
    }));

    return NextResponse.json({ users: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load user directory." }, { status: 500 });
  }
}
