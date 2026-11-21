import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import { AUTH_ERROR_MESSAGES, authMethods, siteUrl } from "@/lib/auth-config";
import { forwardCaptchaToSupabase, verifyTurnstile } from "@/lib/turnstile";
import { jsonError, readJson } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

const GENERIC =
  "If an account exists for this email address, a password reset link has been sent.";

export async function POST(request: Request) {
  if (!authMethods.email) return jsonError(AUTH_ERROR_MESSAGES.provider_disabled, 403);

  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;

  if (!email || email.length > 320 || !email.includes("@")) {
    return jsonError("Enter a valid email address.", 400);
  }

  const captcha = await verifyTurnstile(captchaToken, request, "forgot_password");
  if (!captcha.ok) return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });

  const supabase = createRouteClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Server-initiated PKCE: the code verifier cookie is set on this response,
    // so the link must be opened in the same browser. /auth/confirm also
    // supports token_hash links (see AUTH_SETUP.md) that work on any device.
    redirectTo: `${siteUrl(request)}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`,
    captchaToken: forwardCaptchaToSupabase("forgot_password") ? captchaToken : undefined,
  });

  if (error) {
    if (/captcha/i.test(error.message)) {
      return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });
    }
    if (error.status === 429) return jsonError("Too many requests. Please wait and try again.", 429);
    // Other errors are logged but not exposed (no account enumeration).
    console.error("resetPasswordForEmail:", error.message);
  }

  return NextResponse.json({ success: true, message: GENERIC });
}
