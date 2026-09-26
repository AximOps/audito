import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerAuthContext } from "@/lib/server-auth";

const ALLOWED_ROLES = [
  "Compliance Manager",
  "Security Manager",
  "IT Manager",
  "Contributor",
  "Auditor / Read Only",
];

function adminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export async function POST(request: Request) {
  try {
    const { user, profile, organization, error } =
      await getServerAuthContext();

    if (!user || !profile) {
      return NextResponse.json(
        { error: error || "Unauthorized." },
        { status: 401 }
      );
    }

    if (profile.status !== "Active") {
      return NextResponse.json(
        { error: "Your AuditOps account is not active." },
        { status: 403 }
      );
    }

    if (profile.role !== "Organization Admin") {
      return NextResponse.json(
        { error: "Only Organization Admins can invite users." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const email =
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";

    const fullName =
      typeof body.fullName === "string"
        ? body.fullName.trim()
        : "";

    const jobTitle =
      typeof body.jobTitle === "string"
        ? body.jobTitle.trim()
        : "";

    const role =
      typeof body.role === "string"
        ? body.role.trim()
        : "Contributor";

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role." },
        { status: 400 }
      );
    }

    if (user.email?.toLowerCase() === email) {
      return NextResponse.json(
        { error: "You cannot invite yourself." },
        { status: 400 }
      );
    }

    const admin = adminClient();

    /*
     * First check whether an AuditOps profile already exists.
     * user_profiles is still retained as the global identity record
     * during this migration.
     */
    const { data: existingProfile, error: existingProfileError } =
      await admin
        .from("user_profiles")
        .select("id,email,full_name,job_title,status,organization_id")
        .ilike("email", email)
        .maybeSingle();

    if (existingProfileError) {
      console.error("Existing profile lookup failed:", existingProfileError);

      return NextResponse.json(
        { error: "Unable to check whether the user already exists." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      const { data: existingMembership } = await admin
        .from("organization_memberships")
        .select("id,status,role")
        .eq("organization_id", profile.organization_id)
        .eq("user_id", existingProfile.id)
        .maybeSingle();

      if (existingMembership) {
        return NextResponse.json(
          {
            error:
              "A user with this email already has access to this organization.",
          },
          { status: 409 }
        );
      }

      /*
       * Existing AuditOps user: add the user to this organization
       * without creating a second auth account or duplicate profile.
       */
      const { error: membershipError } = await admin
        .from("organization_memberships")
        .insert({
          organization_id: profile.organization_id,
          user_id: existingProfile.id,
          role,
          status: "Active",
          is_default: false,
        });

      if (membershipError) {
        return NextResponse.json(
          { error: membershipError.message },
          { status: 400 }
        );
      }

      await admin.from("audit_logs").insert({
        organization_id: profile.organization_id,
        user_id: user.id,
        action: "USER_ADDED_TO_ORGANIZATION",
        entity_type: "organization_membership",
        entity_id: existingProfile.id,
        new_values: {
          email,
          full_name: existingProfile.full_name,
          role,
          organization: organization?.[0]?.name ?? null,
        },
      });

      return NextResponse.json(
        {
          success: true,
          message: `${email} already has an AuditOps account and was added to this organization.`,
          userId: existingProfile.id,
        },
        { status: 200 }
      );
    }

    /*
     * New AuditOps user: create the Supabase invitation first.
     */
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const { data: invitedUser, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${siteUrl}/auth/callback`,
        data: {
          full_name: fullName,
          job_title: jobTitle,
          organization_id: profile.organization_id,
          role,
        },
      });

    if (inviteError || !invitedUser.user) {
      console.error("Supabase invitation failed:", inviteError);

      return NextResponse.json(
        {
          error:
            inviteError?.message ||
            "Unable to create the invitation.",
        },
        { status: 400 }
      );
    }

    const newUserId = invitedUser.user.id;

    const { error: insertProfileError } = await admin
      .from("user_profiles")
      .insert({
        id: newUserId,
        organization_id: profile.organization_id,
        email,
        full_name: fullName,
        job_title: jobTitle || null,
        role,
        status: "Invited",
        invited_at: new Date().toISOString(),
      });

    if (insertProfileError) {
      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        {
          error:
            "The invitation was created but the AuditOps profile could not be created.",
        },
        { status: 500 }
      );
    }

    const { error: membershipError } = await admin
      .from("organization_memberships")
      .insert({
        organization_id: profile.organization_id,
        user_id: newUserId,
        role,
        status: "Invited",
        is_default: true,
      });

    if (membershipError) {
      await admin.from("user_profiles").delete().eq("id", newUserId);
      await admin.auth.admin.deleteUser(newUserId);

      return NextResponse.json(
        { error: "The organization membership could not be created." },
        { status: 500 }
      );
    }

    await admin.from("audit_logs").insert({
      organization_id: profile.organization_id,
      user_id: user.id,
      action: "USER_INVITED",
      entity_type: "organization_membership",
      entity_id: newUserId,
      new_values: {
        email,
        full_name: fullName,
        job_title: jobTitle || null,
        role,
        status: "Invited",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Invitation sent to ${email}.`,
        userId: newUserId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Invite user unexpected error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      { status: 500 }
    );
  }
}
