import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const organizationId =
    typeof window !== "undefined"
      ? window.localStorage.getItem("auditops_active_organization")
      : null;

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: organizationId
          ? { "x-organization-id": organizationId }
          : {},
      },
    }
  );
}