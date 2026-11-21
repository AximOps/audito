/**
 * Sign-in method configuration. NEXT_PUBLIC_* values are inlined at build
 * time and safe for the browser; everything else is server-only.
 */

export type OAuthProvider = "google" | "azure";
export type SignInMethod = OAuthProvider | "email";

function flag(value: string | undefined, fallback: boolean) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export const authMethods = {
  email: flag(process.env.NEXT_PUBLIC_AUTH_EMAIL_ENABLED, true),
  google: flag(process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED, false),
  azure: flag(process.env.NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED, false),
  signup: flag(process.env.NEXT_PUBLIC_AUTH_SIGNUP_ENABLED, false),
};

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

export const PROVIDER_LABELS: Record<SignInMethod, string> = {
  google: "Google",
  azure: "Microsoft",
  email: "Email & password",
};

export function isOAuthProvider(value: unknown): value is OAuthProvider {
  return value === "google" || value === "azure";
}

export function isProviderEnabled(provider: SignInMethod) {
  return authMethods[provider];
}

/**
 * What happens when someone authenticates (Google / Microsoft / sign-up) but
 * has no invitation and no verified organization domain:
 *   deny    - sign-in refused, the orphan Auth account is removed (default)
 *   pending - a directory record is created with status Pending; a Platform
 *             Admin approves it and adds the user to an organization
 */
export function unknownUserPolicy(): "deny" | "pending" {
  return process.env.AUTH_UNKNOWN_USER_POLICY === "pending" ? "pending" : "deny";
}

export function siteUrl(request?: Request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (request) return new URL(request.url).origin;
  return "http://localhost:3000";
}

/** Only allow same-site relative redirects ("/x", not "//evil" or "/\\evil"). */
export function safeNextPath(value: unknown, fallback = "/dashboard") {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\r\n]/.test(value)) return fallback;
  if (value.startsWith("/login") || value.startsWith("/signup")) return fallback;
  return value;
}

export const ACTIVE_ORG_COOKIE = "auditops_active_organization";

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_code: "The sign-in link is incomplete. Please try again.",
  session_error: "We could not establish your session. Please sign in again.",
  account_disabled: "Your AuditOps account is disabled. Contact your administrator.",
  account_suspended: "Your AuditOps account is suspended. Contact your administrator.",
  account_inactive: "Your AuditOps account is not active.",
  not_provisioned:
    "No AuditOps access exists for this account. Ask your organization administrator for an invitation.",
  provider_not_allowed: "This sign-in method is not allowed for your organization.",
  provider_disabled: "This sign-in method is not enabled.",
  email_missing: "Your identity provider did not share an email address.",
  email_unverified: "Please verify your email address before signing in.",
  account_conflict:
    "This email address is already linked to another AuditOps account. Contact your administrator.",
  captcha_failed: "Security check failed. Please try again.",
  link_expired: "This link is invalid or has expired. Please request a new one.",
};
