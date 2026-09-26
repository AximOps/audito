import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { createAdminClient } from "@/lib/admin";

export async function GET() {
  try {
    const { user, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (platformRole !== "Platform Admin") return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });

    const admin = createAdminClient();
    const { data, error: queryError } = await admin
      .from("platform_users")
      .select("user_id,role,status,created_at,updated_at,user:users!user_id(id,email,full_name,job_title,status,last_login_at)")
      .order("created_at", { ascending: true });

    if (queryError) return NextResponse.json({ error: queryError.message }, { status: 500 });
    return NextResponse.json({ admins: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to load platform admins." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (platformRole !== "Platform Admin") return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });

    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    if (email === (user.email || "").toLowerCase()) {
      return NextResponse.json({ error: "You already have Platform Admin access." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingUser } = await admin
      .from("users")
      .select("id,email,full_name,status")
      .ilike("email", email)
      .maybeSingle();

    if (existingUser) {
      const { data: existingAdmin } = await admin
        .from("platform_users")
        .select("user_id,status")
        .eq("user_id", existingUser.id)
        .maybeSingle();

      if (existingAdmin) return NextResponse.json({ error: "This user is already a Platform Admin." }, { status: 409 });

      if (existingUser.status === "Disabled") return NextResponse.json({ error: "This user is disabled." }, { status: 400 });

      const { error: insertError } = await admin.from("platform_users").insert({
        user_id: existingUser.id,
        role: "Platform Admin",
        status: "Active",
      });
      if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });

      await admin.from("audit_logs").insert({
        organization_id: null,
        user_id: user.id,
        action: "PLATFORM_ADMIN_GRANTED",
        entity_type: "platform_user",
        entity_id: existingUser.id,
        new_values: { email },
      });

      return NextResponse.json({ success: true, message: `${email} is now a Platform Admin.` });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
      data: { full_name: fullName, job_title: jobTitle, platform_role: "Platform Admin" },
    });

    if (inviteError || !invited.user) {
      return NextResponse.json({ error: inviteError?.message || "Unable to create the invitation." }, { status: 400 });
    }

    const newUserId = invited.user.id;

    const { error: userError } = await admin.from("users").insert({
      id: newUserId,
      email,
      full_name: fullName,
      job_title: jobTitle || null,
      status: "Invited",
    });

    if (userError) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    const { error: platformError } = await admin.from("platform_users").insert({
      user_id: newUserId,
      role: "Platform Admin",
      status: "Active",
    });

    if (platformError) {
      await admin.from("users").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: platformError.message }, { status: 500 });
    }

    await admin.from("audit_logs").insert({
      organization_id: null,
      user_id: user.id,
      action: "PLATFORM_ADMIN_INVITED",
      entity_type: "platform_user",
      entity_id: newUserId,
      new_values: { email, full_name: fullName, job_title: jobTitle || null },
    });

    return NextResponse.json({ success: true, message: `Platform Admin invitation sent to ${email}.` }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to manage Platform Admin." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { user, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (platformRole !== "Platform Admin") return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });

    const body = await request.json();
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
    if (userId === user.id) return NextResponse.json({ error: "You cannot change your own Platform Admin status." }, { status: 400 });

    const status = body.status === "Suspended" ? "Suspended" : "Active";
    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from("platform_users")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("role", "Platform Admin");

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to update Platform Admin." }, { status: 500 });
  }
}
