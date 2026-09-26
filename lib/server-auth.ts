import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function getServerAuthContext() {
  const cookieStore = cookies();
  const activeOrganizationId =
    cookieStore.get("auditops_active_organization")?.value || null;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: activeOrganizationId
          ? { "x-organization-id": activeOrganizationId }
          : {},
      },
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            );
          } catch {
            // Cookie mutation can be unavailable in some server contexts.
          }
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      supabase,
      user: null,
      profile: null,
      organization: null,
      platformRole: null,
      error: "Unauthorized.",
    };
  }

  const [{ data: appUser, error: userError }, { data: platformUser }] =
    await Promise.all([
      supabase
        .from("users")
        .select(
          "id,email,full_name,job_title,status,email_verified_at,last_login_at,created_at"
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("platform_users")
        .select("user_id,role,status")
        .eq("user_id", user.id)
        .eq("status", "Active")
        .maybeSingle(),
    ]);

  if (userError || !appUser) {
    return {
      supabase,
      user,
      profile: null,
      organization: null,
      platformRole: platformUser?.role || null,
      error: "Your AuditOps user directory record could not be found.",
    };
  }

  if (appUser.status === "Disabled" || appUser.status === "Suspended") {
    return {
      supabase,
      user,
      profile: null,
      organization: null,
      platformRole: null,
      error: appUser.status === "Suspended" ? "Your AuditOps account is suspended." : "Your AuditOps account is disabled.",
    };
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false })
    .limit(20);

  const selected =
    memberships?.find(
      (item) => item.organization_id === activeOrganizationId
    ) || memberships?.find((item) => item.is_default) || memberships?.[0];

  if (!selected) {
    return {
      supabase,
      user,
      profile: {
        ...appUser,
        organization_id: null,
        role: null,
        membership_id: null,
      },
      organization: null,
      platformRole: platformUser?.role || null,
      error: null,
    };
  }

  const organization = Array.isArray(selected.organization)
    ? selected.organization[0]
    : selected.organization;

  if (!organization) {
    return {
      supabase,
      user,
      profile: null,
      organization: null,
      platformRole: platformUser?.role || null,
      error: "Organization not found.",
    };
  }

  if (organization.status !== "Active") {
    return {
      supabase,
      user,
      profile: null,
      organization,
      platformRole: platformUser?.role || null,
      error: "Your AuditOps organization is not active.",
    };
  }

  return {
    supabase,
    user,
    profile: {
      ...appUser,
      organization_id: selected.organization_id,
      role: selected.role,
      membership_id: selected.id,
    },
    organization,
    platformRole: platformUser?.role || null,
    error: null,
  };
}
