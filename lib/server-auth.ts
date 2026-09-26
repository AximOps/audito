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
          } catch {}
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
      error: "Unauthorized.",
    };
  }

  const { data: baseProfile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,organization_id,full_name,job_title,role,status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !baseProfile) {
    return {
      supabase,
      user,
      profile: null,
      organization: null,
      error: "Your AuditOps user profile could not be found.",
    };
  }

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false })
    .limit(10);

  const selected =
    membership?.find(
      (item) => item.organization_id === activeOrganizationId
    ) ||
    membership?.find((item) => item.is_default) ||
    membership?.find(
      (item) => item.organization_id === baseProfile.organization_id
    ) ||
    membership?.[0];

  if (!selected) {
    return {
      supabase,
      user,
      profile: null,
      organization: null,
      error: "Your AuditOps organization membership could not be found.",
    };
  }

  if (selected.status !== "Active") {
    return {
      supabase,
      user,
      profile: null,
      organization: selected.organization,
      error: "Your AuditOps organization membership is not active.",
    };
  }

  return {
    supabase,
    user,
    profile: {
      ...baseProfile,
      organization_id: selected.organization_id,
      role: selected.role,
      status: selected.status,
      membership_id: selected.id,
    },
    organization: selected.organization || null,
    error: null,
  };
}
