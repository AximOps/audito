import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";

const ROLES = [
  "Organization Admin",
  "Compliance Manager",
  "Security Manager",
  "IT Manager",
  "Contributor",
  "Auditor / Read Only",
];

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  try {
    const { user, profile, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });

    const body = await request.json();
    const admin = createAdminClient();

    const { data: target } = await admin
      .from("users")
      .select("id,email,full_name,job_title,status")
      .eq("id", context.params.id)
      .maybeSingle();

    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    if (platformRole === "Platform Admin") {
      const userChanges: Record<string, unknown> = {};
      if (typeof body.fullName === "string") userChanges.full_name = body.fullName.trim();
      if (typeof body.jobTitle === "string") userChanges.job_title = body.jobTitle.trim() || null;
      if (["Active", "Suspended", "Disabled", "Invited"].includes(body.status)) userChanges.status = body.status;

      if (Object.keys(userChanges).length) {
        userChanges.updated_at = new Date().toISOString();
        const { error: updateError } = await admin.from("users").update(userChanges).eq("id", target.id);
        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      if (typeof body.email === "string" && body.email.trim().toLowerCase() !== target.email.toLowerCase()) {
        const email = body.email.trim().toLowerCase();
        const { error: authError } = await admin.auth.admin.updateUserById(target.id, { email });
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
        const { error: emailError } = await admin.from("users").update({ email }).eq("id", target.id);
        if (emailError) return NextResponse.json({ error: emailError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true });
    }

    if (profile?.role !== "Organization Admin" || !profile.organization_id) {
      return NextResponse.json({ error: "Only Organization Admins can manage organization users." }, { status: 403 });
    }

    const { data: membership } = await admin
      .from("organization_memberships")
      .select("id,role,status")
      .eq("organization_id", profile.organization_id)
      .eq("user_id", target.id)
      .maybeSingle();

    if (!membership) return NextResponse.json({ error: "User is not a member of this organization." }, { status: 404 });
    if (target.id === user.id && (body.role || body.status)) {
      return NextResponse.json({ error: "You cannot change your own organization role or membership status." }, { status: 400 });
    }

    const changes: Record<string, unknown> = {};
    if (typeof body.role === "string") {
      if (!ROLES.includes(body.role)) return NextResponse.json({ error: "Invalid organization role." }, { status: 400 });
      changes.role = body.role;
    }
    if (["Active", "Invited", "Suspended"].includes(body.status)) changes.status = body.status;

    if (Object.keys(changes).length) {
      changes.updated_at = new Date().toISOString();
      const { error: updateError } = await admin
        .from("organization_memberships")
        .update(changes)
        .eq("id", membership.id);
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const userChanges: Record<string, unknown> = {};
    if (typeof body.fullName === "string") userChanges.full_name = body.fullName.trim();
    if (typeof body.jobTitle === "string") userChanges.job_title = body.jobTitle.trim() || null;
    if (Object.keys(userChanges).length) {
      userChanges.updated_at = new Date().toISOString();
      const { error: updateUserError } = await admin.from("users").update(userChanges).eq("id", target.id);
      if (updateUserError) return NextResponse.json({ error: updateUserError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unable to update user." },
      { status: 500 }
    );
  }
}
