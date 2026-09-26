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

export async function GET() {
  try {
    const { user, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (platformRole !== "Platform Admin") return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });

    const admin = createAdminClient();
    const [{ data: users, error: usersError }, { data: organizations, error: orgError }] = await Promise.all([
      admin.from("users").select("id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at").order("created_at", { ascending: false }),
      admin.from("organizations").select("id,name,slug,status,plan").order("name"),
    ]);

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 });
    if (orgError) return NextResponse.json({ error: orgError.message }, { status: 500 });

    const { data: memberships, error: membershipError } = await admin
      .from("organization_memberships")
      .select("id,user_id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug)");

    if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 500 });

    return NextResponse.json({ users: users || [], organizations: organizations || [], memberships: memberships || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to load user directory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, platformRole, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    if (platformRole !== "Platform Admin") return NextResponse.json({ error: "Platform Admin access required." }, { status: 403 });

    const body = await request.json();
    const action = body.action === "add_existing" ? "add_existing" : "invite";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim() : "";
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : "";
    const role = typeof body.role === "string" ? body.role : "Contributor";

    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
    if (!ROLES.includes(role)) return NextResponse.json({ error: "Invalid organization role." }, { status: 400 });

    const admin = createAdminClient();
    if (organizationId) {
      const { data: org } = await admin.from("organizations").select("id,status").eq("id", organizationId).maybeSingle();
      if (!org || org.status !== "Active") return NextResponse.json({ error: "Organization does not exist or is not active." }, { status: 400 });
    }

    const { data: existingUser } = await admin.from("users").select("id,email,status").ilike("email", email).maybeSingle();

    if (existingUser || action === "add_existing") {
      if (!existingUser) return NextResponse.json({ error: "No existing AuditOps user was found with this email." }, { status: 404 });
      if (!organizationId) return NextResponse.json({ error: "Organization is required when adding an existing user." }, { status: 400 });
      if (["Disabled", "Suspended"].includes(existingUser.status)) return NextResponse.json({ error: "This user is not active." }, { status: 400 });

      const { data: existingMembership } = await admin.from("organization_memberships").select("id").eq("organization_id", organizationId).eq("user_id", existingUser.id).maybeSingle();
      if (existingMembership) return NextResponse.json({ error: "The user is already a member of this organization." }, { status: 409 });

      const { data: membership, error: membershipError } = await admin.from("organization_memberships").insert({
        organization_id: organizationId,
        user_id: existingUser.id,
        role,
        status: "Active",
        is_default: false,
      }).select("id,user_id,organization_id,role,status,is_default").single();

      if (membershipError) return NextResponse.json({ error: membershipError.message }, { status: 400 });
      await admin.from("audit_logs").insert({ organization_id: organizationId, user_id: user.id, action: "USER_ADDED_TO_ORGANIZATION", entity_type: "organization_membership", entity_id: membership.id, new_values: { email, role } });
      return NextResponse.json({ success: true, message: `${email} was added to the organization.` });
    }

    if (!fullName) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/callback`,
      data: { full_name: fullName, job_title: jobTitle, organization_id: organizationId || null, role },
    });
    if (inviteError || !invited.user) return NextResponse.json({ error: inviteError?.message || "Unable to create the invitation." }, { status: 400 });

    const newUserId = invited.user.id;
    const { error: userError } = await admin.from("users").insert({ id: newUserId, email, full_name: fullName, job_title: jobTitle || null, status: "Invited" });
    if (userError) {
      await admin.auth.admin.deleteUser(newUserId);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    if (organizationId) {
      const { error: membershipError } = await admin.from("organization_memberships").insert({ organization_id: organizationId, user_id: newUserId, role, status: "Invited", is_default: true });
      if (membershipError) {
        await admin.from("users").delete().eq("id", newUserId);
        await admin.auth.admin.deleteUser(newUserId);
        return NextResponse.json({ error: membershipError.message }, { status: 500 });
      }
      await admin.from("user_profiles").upsert({ id: newUserId, organization_id: organizationId, full_name: fullName, job_title: jobTitle || null, role, status: "Invited" }, { onConflict: "id" });
    }

    await admin.from("audit_logs").insert({ organization_id: organizationId || null, user_id: user.id, action: "USER_INVITED", entity_type: "user", entity_id: newUserId, new_values: { email, full_name: fullName, role, organization_id: organizationId || null } });
    return NextResponse.json({ success: true, message: `Invitation sent to ${email}.` }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to manage user directory." }, { status: 500 });
  }
}
