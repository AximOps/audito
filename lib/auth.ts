import { createBrowserClient } from "@supabase/ssr";

export const ACTIVE_ORGANIZATION_STORAGE_KEY = "auditops_active_organization";

export type OrganizationMembership = {
  id: string;
  organization_id: string;
  role: string;
  status: string;
  is_default: boolean;
  organization?: {
    id: string;
    name: string;
    slug: string;
    industry: string | null;
    timezone: string | null;
    status: string;
    plan: string;
  } | null;
};

function getActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
}

export function setActiveOrganizationId(organizationId: string) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      ACTIVE_ORGANIZATION_STORAGE_KEY,
      organizationId
    );
  }
}

export function clearActiveOrganizationId() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  }
}

export function createClient() {
  const activeOrganizationId = getActiveOrganizationId();

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: activeOrganizationId
          ? { "x-organization-id": activeOrganizationId }
          : {},
      },
    }
  );
}

export async function getCurrentProfile() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, profile: null, organization: null, platformRole: null };

  const [{ data: baseProfile }, { data: platformUser }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select(
          "id, organization_id, full_name, job_title, role, status"
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

  const platformRole = platformUser?.role || null;

  if (!baseProfile) {
    return {
      user,
      profile: null,
      organization: null,
      platformRole,
    };
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", user.id)
    .eq("status", "Active");

  const activeRequested = getActiveOrganizationId();

  let membership =
    memberships?.find(
      (item) => item.organization_id === activeRequested
    ) ||
    memberships?.find((item) => item.is_default) ||
    memberships?.find(
      (item) => item.organization_id === baseProfile.organization_id
    ) ||
    memberships?.[0];

  if (!membership) {
    return {
      user,
      profile: baseProfile,
      organization: null,
      platformRole,
    };
  }

  if (
    typeof window !== "undefined" &&
    getActiveOrganizationId() !== membership.organization_id
  ) {
    setActiveOrganizationId(membership.organization_id);
  }

  return {
    user,
    profile: {
      ...baseProfile,
      organization_id: membership.organization_id,
      role: membership.role,
      status: membership.status,
      membership_id: membership.id,
    },
    organization: membership.organization || null,
    platformRole,
  };
}

export async function getOrganizationMemberships(): Promise<
  OrganizationMembership[]
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
    .eq("status", "Active")
    .order("is_default", { ascending: false });

  if (error) {
    console.error("Unable to load organization memberships:", error);
    return [];
  }

  return (data || []) as unknown as OrganizationMembership[];
}
