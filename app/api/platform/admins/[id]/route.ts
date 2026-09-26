import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

const ALLOWED_STATUSES = ["Active", "Suspended"] as const;

type ApplicationUser = {
  id: string;
  email: string;
  full_name: string | null;
  job_title: string | null;
  status: string;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

type PlatformUser = {
  id: string;
  user_id: string;
  role: string;
  status: string;
};

type CookieToSet = {
  name: string;
  value: string;
  options?: {
    domain?: string;
    expires?: Date;
    httpOnly?: boolean;
    maxAge?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none" | boolean;
    secure?: boolean;
  };
};

async function getContext() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {}
        },
      },
    }
  );

  const {
    data: { user: currentUser },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !currentUser) {
    return { currentUser: null, admin: null, error: "Unauthorized" };
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return {
      currentUser,
      admin: null,
      error: "SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  const admin = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  const { data: platformAdmin, error: platformError } = await admin
    .from("platform_users")
    .select("id,user_id,role,status")
    .eq("user_id", currentUser.id)
    .eq("role", "Platform Admin")
    .eq("status", "Active")
    .maybeSingle();

  if (platformError) {
    return { currentUser, admin, error: platformError.message };
  }

  if (!platformAdmin) {
    return {
      currentUser,
      admin,
      error: "Platform Admin access required.",
    };
  }

  return { currentUser, admin, error: null };
}

async function resolveTarget(
  // The service-role client is intentionally treated as an untyped server
  // client here because the project's generated Supabase Database type is
  // currently stale for the application user tables.
  admin: any,
  id: string
): Promise<{
  appUser: ApplicationUser;
  platformUser: PlatformUser;
} | null> {
  // The UI may pass either the application user ID or the platform_users.user_id.
  const { data: appUser } = await admin
    .from("users")
    .select(
      "id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at,updated_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (appUser) {
    const applicationUser = appUser as ApplicationUser;

    const { data: platformUser } = await admin
      .from("platform_users")
      .select("id,user_id,role,status")
      .eq("user_id", id)
      .eq("role", "Platform Admin")
      .maybeSingle();

    if (platformUser) {
      return { appUser: applicationUser, platformUser: platformUser as PlatformUser };
    }

    // If platform_users.user_id is the Auth UUID, resolve by email.
    const { data: authUsers } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    // Explicitly type only the Auth fields used here. This avoids
    // Supabase generated-type inference resolving the users collection
    // to `never` in this route.
    const authUserList = authUsers as {
      users: Array<{
        id: string;
        email?: string | null;
      }>;
    } | null;

    const applicationUserEmail =
      (appUser as { email: string }).email;

    const authUser = authUserList?.users.find(
      (candidate) =>
        candidate.email?.toLowerCase() ===
        applicationUserEmail.toLowerCase()
    );

    if (authUser) {
      const { data: platformByAuthId } = await admin
        .from("platform_users")
        .select("id,user_id,role,status")
        .eq("user_id", authUser.id)
        .eq("role", "Platform Admin")
        .maybeSingle();

      if (platformByAuthId) {
        return { appUser, platformUser: platformByAuthId };
      }
    }
  }

  // Finally allow the route to be called with platform_users.user_id.
  const { data: platformUser } = await admin
    .from("platform_users")
    .select("id,user_id,role,status")
    .eq("user_id", id)
    .eq("role", "Platform Admin")
    .maybeSingle();

  if (!platformUser) {
    return null;
  }

  const resolvedPlatformUser = platformUser as PlatformUser;

  const { data: authUser } = await admin.auth.admin.getUserById(
    resolvedPlatformUser.user_id
  );

  const email = authUser.user?.email;

  if (!email) {
    return null;
  }

  const { data: fallbackAppUser } = await admin
    .from("users")
    .select(
      "id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at,updated_at"
    )
    .eq("email", email)
    .maybeSingle();

  if (!fallbackAppUser) {
    return null;
  }

  return {
    appUser: fallbackAppUser as ApplicationUser,
    platformUser: resolvedPlatformUser,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { admin, error } = await getContext();

    if (error || !admin) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: error === "Unauthorized" ? 401 : 403 }
      );
    }

    const target = await resolveTarget(admin, params.id);

    if (!target) {
      return NextResponse.json(
        { error: "Platform Admin user not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: target.appUser,
      platformAdmin: target.platformUser,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { currentUser, admin, error } = await getContext();

    if (error || !admin || !currentUser) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: error === "Unauthorized" ? 401 : 403 }
      );
    }

    const target = await resolveTarget(admin, params.id);

    if (!target) {
      return NextResponse.json(
        { error: "Platform Admin user not found." },
        { status: 404 }
      );
    }

    const body = await request.json();

    const fullName =
      typeof body?.fullName === "string"
        ? body.fullName.trim()
        : undefined;

    const jobTitle =
      typeof body?.jobTitle === "string"
        ? body.jobTitle.trim()
        : undefined;

    const email =
      typeof body?.email === "string"
        ? body.email.trim().toLowerCase()
        : undefined;

    const status =
      typeof body?.status === "string"
        ? body.status
        : undefined;

    if (fullName !== undefined && !fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (email !== undefined && (!email || !email.includes("@"))) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (
      status !== undefined &&
      !ALLOWED_STATUSES.includes(
        status as (typeof ALLOWED_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        { error: "Invalid Platform Admin status." },
        { status: 400 }
      );
    }

    // Do not allow an administrator to suspend their own account.
    if (
      target.platformUser.user_id === currentUser.id &&
      status === "Suspended"
    ) {
      return NextResponse.json(
        {
          error:
            "You cannot suspend your own Platform Admin account.",
        },
        { status: 400 }
      );
    }

    const userUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName !== undefined) {
      userUpdate.full_name = fullName;
    }

    if (jobTitle !== undefined) {
      userUpdate.job_title = jobTitle;
    }

    let authEmailUpdated = false;

    if (
      email !== undefined &&
      email !== target.appUser.email.toLowerCase()
    ) {
      const { data: duplicate } = await admin
        .from("users")
        .select("id")
        .ilike("email", email)
        .neq("id", target.appUser.id)
        .maybeSingle();

      if (duplicate) {
        return NextResponse.json(
          {
            error:
              "Another application user already uses this email.",
          },
          { status: 409 }
        );
      }

      const { data: authUsers, error: authListError } =
        await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

      if (authListError) {
        return NextResponse.json(
          { error: authListError.message },
          { status: 500 }
        );
      }

      const authUser = authUsers.users.find(
        (candidate) =>
          candidate.email?.toLowerCase() ===
          target.appUser.email.toLowerCase()
      );

      if (!authUser) {
        return NextResponse.json(
          {
            error:
              "The corresponding Supabase Auth user could not be found. Email was not changed.",
          },
          { status: 400 }
        );
      }

      const { error: authUpdateError } =
        await admin.auth.admin.updateUserById(authUser.id, {
          email,
          email_confirm: false,
        });

      if (authUpdateError) {
        return NextResponse.json(
          {
            error:
              `Supabase Auth email update failed: ${authUpdateError.message}`,
          },
          { status: 500 }
        );
      }

      userUpdate.email = email;
      userUpdate.email_verified_at = null;
      authEmailUpdated = true;
    }

    if (status !== undefined) {
      userUpdate.status = status;
    }

    const { data: updatedUser, error: userUpdateError } = await admin
      .from("users")
      .update(userUpdate)
      .eq("id", target.appUser.id)
      .select(
        "id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at,updated_at"
      )
      .single();

    if (userUpdateError) {
      return NextResponse.json(
        { error: userUpdateError.message },
        { status: 500 }
      );
    }

    if (status !== undefined) {
      const { error: platformUpdateError } = await admin
        .from("platform_users")
        .update({ status })
        .eq("id", target.platformUser.id);

      if (platformUpdateError) {
        return NextResponse.json(
          { error: platformUpdateError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
      platformAdmin: {
        ...target.platformUser,
        status:
          status !== undefined ? status : target.platformUser.status,
      },
      authEmailUpdated,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { currentUser, admin, error } = await getContext();

    if (error || !admin || !currentUser) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: error === "Unauthorized" ? 401 : 403 }
      );
    }

    const target = await resolveTarget(admin, params.id);
    if (!target) {
      return NextResponse.json(
        { error: "Platform Admin user not found." },
        { status: 404 }
      );
    }

    if (target.platformUser.user_id === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot remove your own Platform Admin access." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await admin
      .from("platform_users")
      .delete()
      .eq("id", target.platformUser.id)
      .eq("role", "Platform Admin");

    if (deleteError) {
      return NextResponse.json(
        { error: deleteError.message },
        { status: 400 }
      );
    }

    await admin.from("audit_logs").insert({
      organization_id: null,
      user_id: currentUser.id,
      action: "PLATFORM_ADMIN_ACCESS_REMOVED",
      entity_type: "platform_user",
      entity_id: target.platformUser.id,
      old_values: {
        user_id: target.platformUser.user_id,
        email: target.appUser.email,
        role: "Platform Admin",
        status: target.platformUser.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Platform Admin access removed. The AuditOps user account was retained.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to remove Platform Admin access.",
      },
      { status: 500 }
    );
  }
}
