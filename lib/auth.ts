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

// The active organization lives in one cookie shared by browser and server
// (lib/server-auth.ts reads the same name), so both always agree. The
// localStorage copy is kept for older code paths only.
function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) || null : null;
}

function getActiveOrganizationId(): string | null {
  if (typeof window === "undefined") return null;
  return (
    readCookie(ACTIVE_ORGANIZATION_STORAGE_KEY) ||
    window.localStorage.getItem(ACTIVE_ORGANIZATION_STORAGE_KEY)
  );
}

export function setActiveOrganizationId(organizationId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_ORGANIZATION_STORAGE_KEY, organizationId);
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${ACTIVE_ORGANIZATION_STORAGE_KEY}=${encodeURIComponent(
    organizationId
  )}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax${secure}`;
}

export function clearActiveOrganizationId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_ORGANIZATION_STORAGE_KEY);
  document.cookie = `${ACTIVE_ORGANIZATION_STORAGE_KEY}=; path=/; max-age=0`;
}

/** Signs out on the server (clears auth + org cookies, writes audit log). */
export async function signOutEverywhere() {
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    await createClient().auth.signOut();
  }
  clearActiveOrganizationId();
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

  if (!user) {
    return { user: null, profile: null, organization: null, platformRole: null };
  }

  const [{ data: appUser }, { data: platformUser }] = await Promise.all([
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

  if (!appUser) {
    return {
      user,
      profile: null,
      organization: null,
      platformRole: platformUser?.role || null,
    };
  }

  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false });

  const activeRequested = getActiveOrganizationId();
  const membership =
    memberships?.find((item) => item.organization_id === activeRequested) ||
    memberships?.find((item) => item.is_default) ||
    memberships?.[0];

  if (!membership) {
    return {
      user,
      profile: {
        ...appUser,
        organization_id: null,
        role: null,
        membership_id: null,
      },
      organization: null,
      platformRole: platformUser?.role || null,
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
      ...appUser,
      organization_id: membership.organization_id,
      role: membership.role,
      membership_id: membership.id,
    },
    organization: membership.organization || null,
    platformRole: platformUser?.role || null,
  };
}

export async function getOrganizationMemberships(): Promise<OrganizationMembership[]> {
  const supabase = createClient();
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) return [];

  const { data, error } = await supabase
    .from("organization_memberships")
    .select(
      "id,organization_id,role,status,is_default,organization:organizations!organization_id(id,name,slug,industry,timezone,status,plan)"
    )
    .eq("user_id", authData.user.id)
    .eq("status", "Active")
    .order("is_default", { ascending: false });

  if (error) {
    console.error("Unable to load organization memberships:", error);
    return [];
  }

  return (data || []) as unknown as OrganizationMembership[];
}
