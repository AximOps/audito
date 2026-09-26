import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";

async function requirePlatformAdmin() {
  const context = await getServerAuthContext();
  if (!context.user) return { error: context.error || "Unauthorized.", status: 401 as const };
  if (context.platformRole !== "Platform Admin") return { error: "Platform Admin access required.", status: 403 as const };
  return { context };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePlatformAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user: currentUser } = auth.context;
    const admin = createAdminClient();
    const body = await request.json();

    const { data: target, error: targetError } = await admin.from("users").select("id,email,full_name,job_title,status").eq("id", params.id).maybeSingle();
    if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    if (target.id === currentUser.id && ["Suspended", "Disabled"].includes(body.status)) {
      return NextResponse.json({ error: "You cannot suspend or disable your own account." }, { status: 400 });
    }

    const userChanges: Record<string, unknown> = {};
    if (typeof body.fullName === "string") userChanges.full_name = body.fullName.trim();
    if (typeof body.jobTitle === "string") userChanges.job_title = body.jobTitle.trim() || null;
    if (["Active", "Invited", "Suspended", "Disabled"].includes(body.status)) userChanges.status = body.status;

    if (typeof body.email === "string") {
      const email = body.email.trim().toLowerCase();
      if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
      if (email !== target.email.toLowerCase()) {
        const { error: authError } = await admin.auth.admin.updateUserById(target.id, { email, email_confirm: false });
        if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });
        userChanges.email = email;
        userChanges.email_verified_at = null;
      }
    }

    if (Object.keys(userChanges).length) {
      userChanges.updated_at = new Date().toISOString();
      const { error } = await admin.from("users").update(userChanges).eq("id", target.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update user." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requirePlatformAdmin();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { user: currentUser } = auth.context;
    if (params.id === currentUser.id) return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });

    const admin = createAdminClient();
    const { data: target } = await admin.from("users").select("id,email,full_name,status").eq("id", params.id).maybeSingle();
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

    // Global directory removal means removing access from every organization and platform role.
    // The application user and audit history are retained.
    const { error: membershipError } = await admin.from("organization_memberships").delete().eq("user_id", params.id);
    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });

    const { error: platformError } = await admin.from("platform_users").delete().eq("user_id", params.id);
    if (platformError) return NextResponse.json({ error: platformError.message }, { status: 400 });

    await admin.from("audit_logs").insert({
      organization_id: null,
      user_id: currentUser.id,
      action: "USER_ACCESS_REMOVED_GLOBALLY",
      entity_type: "user",
      entity_id: target.id,
      old_values: { email: target.email, full_name: target.full_name, status: target.status },
    });

    return NextResponse.json({ success: true, message: "User access was removed from all organizations. The AuditOps user account and audit history were retained." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to remove user." }, { status: 500 });
  }
}
