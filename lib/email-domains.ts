import { ROLE_OPTIONS } from "@/lib/rbac";

export const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "gmx.net", "mail.com", "yandex.com", "zoho.com",
  "rediffmail.com",
]);

export const AUTH_PROVIDERS = ["google", "azure", "email"] as const;
export type DomainProvider = (typeof AUTH_PROVIDERS)[number];

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function normalizeDomain(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const domain = value.trim().toLowerCase().replace(/^@/, "");
  return DOMAIN_RE.test(domain) && domain.length <= 253 ? domain : null;
}

export function validateDomainSettings(body: Record<string, unknown>) {
  const out: { auto_join?: boolean; auto_join_role?: string; allowed_providers?: string[] } = {};
  if (typeof body.autoJoin === "boolean") out.auto_join = body.autoJoin;
  if (body.autoJoinRole !== undefined) {
    if (typeof body.autoJoinRole !== "string" || !ROLE_OPTIONS.includes(body.autoJoinRole as never)) {
      return { error: "Invalid auto-join role." } as const;
    }
    out.auto_join_role = body.autoJoinRole;
  }
  if (body.allowedProviders !== undefined) {
    const list = Array.isArray(body.allowedProviders) ? body.allowedProviders : [];
    const clean = Array.from(new Set(list.filter((p): p is string => AUTH_PROVIDERS.includes(p as DomainProvider))));
    if (clean.length === 0) return { error: "Select at least one sign-in method." } as const;
    out.allowed_providers = clean;
  }
  return { values: out } as const;
}
