import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createRouteClient } from "@/lib/supabase-server";
import { finalizeSignIn } from "@/lib/auth-finalize";
import { safeNextPath } from "@/lib/auth-config";
import { clientIp } from "@/lib/turnstile";
import { setActiveOrgCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

const TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "email", "magiclink", "email_change"];

/**
 * token_hash email links (recommended for SSR; works across devices):
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup
 * See AUTH_SETUP.md for the email template changes.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (!tokenHash || !type || !TYPES.includes(type)) {
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  const supabase = createRouteClient();
  const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=link_expired", origin));
  }

  const result = await finalizeSignIn(data.user, { provider: "email", ip: clientIp(request) });

  if (result.status === "denied") {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(result.reason)}`, origin));
  }

  if (result.status === "pending") {
    return NextResponse.redirect(new URL("/auth/pending", origin));
  }

  // Invited users and recovery links must choose a password first.
  const next =
    type === "invite"
      ? "/auth/reset-password?mode=invite"
      : type === "recovery"
        ? "/auth/reset-password"
        : safeNextPath(url.searchParams.get("next"));

  return setActiveOrgCookie(NextResponse.redirect(new URL(next, origin)), result.organizationId);
}
