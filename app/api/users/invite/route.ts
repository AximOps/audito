import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const ALLOWED_ROLES = [
  "Compliance Manager",
  "Security Manager",
  "IT Manager",
  "Contributor",
  "Auditor / Read Only",
];

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();

    /*
     * ---------------------------------------------------------
     * Authenticated Supabase client
     * ---------------------------------------------------------
     */

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },

          setAll(
            cookiesToSet: {
              name: string;
              value: string;
              options: CookieOptions;
            }[]
          ) {
            try {
              cookiesToSet.forEach(
                ({ name, value, options }) => {
                  cookieStore.set({
                    name,
                    value,
                    ...options,
                  });
                }
              );
            } catch {
              // Cookie modification may not be available
              // in every server execution context.
            }
          },
        },
      }
    );

    /*
     * ---------------------------------------------------------
     * Verify current authenticated user
     * ---------------------------------------------------------
     */

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Load current AuditOps profile
     * ---------------------------------------------------------
     */

    const {
      data: currentProfile,
      error: profileError,
    } = await supabase
      .from("user_profiles")
      .select(
        `
        id,
        organization_id,
        full_name,
        role,
        status,
        email
        `
      )
      .eq("id", user.id)
      .single();

    if (profileError || !currentProfile) {
      return NextResponse.json(
        {
          error:
            "Your AuditOps user profile could not be found.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * RBAC check
     * ---------------------------------------------------------
     */

    if (
      currentProfile.role !==
      "Organization Admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Only Organization Admins can invite users.",
        },
        { status: 403 }
      );
    }

    if (currentProfile.status !== "Active") {
      return NextResponse.json(
        {
          error:
            "Your AuditOps account is not active.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Parse request
     * ---------------------------------------------------------
     */

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

    /*
     * ---------------------------------------------------------
     * Validation
     * ---------------------------------------------------------
     */

    if (!email) {
      return NextResponse.json(
        {
          error: "Email is required.",
        },
        { status: 400 }
      );
    }

    if (!fullName) {
      return NextResponse.json(
        {
          error: "Full name is required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return NextResponse.json(
        {
          error: "Invalid role.",
        },
        { status: 400 }
      );
    }

    /*
     * Do not allow Organization Admin creation
     * through the normal invitation UI.
     */
    if (role === "Organization Admin") {
      return NextResponse.json(
        {
          error:
            "Organization Admin invitations require elevated administration.",
        },
        { status: 400 }
      );
    }

    /*
     * Prevent self-invitation.
     */
    if (
      user.email &&
      user.email.toLowerCase() === email
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot invite yourself.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Check AuditOps profile
     * ---------------------------------------------------------
     */

    const {
      data: existingProfile,
      error: existingProfileError,
    } = await supabase
      .from("user_profiles")
      .select(
        "id, email, status, role"
      )
      .eq(
        "organization_id",
        currentProfile.organization_id
      )
      .ilike("email", email)
      .maybeSingle();

    if (existingProfileError) {
      console.error(
        "Existing profile lookup failed:",
        existingProfileError
      );

      return NextResponse.json(
        {
          error:
            "Unable to check whether the user already exists.",
        },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        {
          error:
            "A user with this email already exists in this organization.",
        },
        { status: 409 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Supabase Admin client
     * ---------------------------------------------------------
     *
     * SERVICE ROLE KEY MUST NEVER be exposed to the browser.
     */

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      console.error(
        "SUPABASE_SERVICE_ROLE_KEY is not configured."
      );

      return NextResponse.json(
        {
          error:
            "Server configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    /*
     * ---------------------------------------------------------
     * Invite user through Supabase Auth
     * ---------------------------------------------------------
     */

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      "http://localhost:3000";

    const {
      data: invitedUser,
      error: inviteError,
    } =
      await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo:
            `${siteUrl}/auth/callback`,
          data: {
            full_name: fullName,
            job_title: jobTitle,
            organization_id:
              currentProfile.organization_id,
            role,
          },
        }
      );

    if (inviteError) {
      console.error(
        "Supabase invitation failed:",
        inviteError
      );

      return NextResponse.json(
        {
          error:
            inviteError.message ||
            "Unable to send invitation.",
        },
        { status: 400 }
      );
    }

    if (!invitedUser.user) {
      return NextResponse.json(
        {
          error:
            "Supabase did not return the invited user.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Create AuditOps user profile
     * ---------------------------------------------------------
     */

    const {
      error: insertProfileError,
    } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        id: invitedUser.user.id,
        organization_id:
          currentProfile.organization_id,
        email,
        full_name: fullName,
        job_title:
          jobTitle || null,
        role,
        status: "Invited",
        invited_at: new Date().toISOString(),
      });

    if (insertProfileError) {
      /*
       * If profile creation failed, remove the Auth user
       * so we don't leave an orphaned account.
       */
      await supabaseAdmin.auth.admin.deleteUser(
        invitedUser.user.id
      );

      console.error(
        "User profile creation failed:",
        insertProfileError
      );

      return NextResponse.json(
        {
          error:
            "The invitation was created but the AuditOps profile could not be created.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Audit log
     * ---------------------------------------------------------
     */

    await supabaseAdmin
  .from("audit_logs")
  .insert({
    organization_id:
      currentProfile.organization_id,
    user_id: user.id,
    action: "USER_INVITED",
    entity_type: "user_profile",
    entity_id: invitedUser.user.id,
    new_values: {
      email,
      full_name: fullName,
      job_title: jobTitle || null,
      role,
      status: "Invited",
    },
  });

    /*
     * ---------------------------------------------------------
     * Response
     * ---------------------------------------------------------
     */

    return NextResponse.json(
      {
        success: true,
        message:
          `Invitation sent to ${email}.`,
        userId: invitedUser.user.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(
      "Invite user unexpected error:",
      error
    );

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