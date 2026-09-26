import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";

export async function POST(request: Request) {
  const { supabase, user } = await getServerAuthContext();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const organizationId =
    typeof body.organization_id === "string"
      ? body.organization_id
      : "";

  if (!organizationId) {
    return NextResponse.json(
      { error: "Organization is required." },
      { status: 400 }
    );
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("id,organization_id,role,status")
    .eq("user_id", user.id)
    .eq("organization_id", organizationId)
    .eq("status", "Active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json(
      { error: "You do not have access to this organization." },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    success: true,
    organization_id: organizationId,
  });

  response.cookies.set({
    name: "auditops_active_organization",
    value: organizationId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
