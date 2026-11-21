import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import { AUTH_ERROR_MESSAGES, authMethods, siteUrl } from "@/lib/auth-config";
import { forwardCaptchaToSupabase, verifyTurnstile } from "@/lib/turnstile";
import { jsonError, readJson } from "@/lib/auth-session";
import { validatePassword } from "@/lib/password-policy";

export const dynamic = "force-dynamic";

const GENERIC =
  "Check your inbox to confirm your email address. After confirming, sign in to continue.";

/**
 * Email / password self-registration. Disabled unless
 * NEXT_PUBLIC_AUTH_SIGNUP_ENABLED=true. Access is still decided on first
 * sign-in by finalizeSignIn(): invitation, verified domain, or
 * AUTH_UNKNOWN_USER_POLICY.
 */
export async function POST(request: Request) {
  if (!authMethods.email || !authMethods.signup) {
    return jsonError("Self sign-up is not enabled. Ask your administrator for an invitation.", 403);
  }

  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;

  if (!email || !email.includes("@") || email.length > 320) return jsonError("Enter a valid email address.", 400);
  if (!fullName) return jsonError("Full name is required.", 400);
  const passwordProblem = validatePassword(password, email);
  if (passwordProblem) return jsonError(passwordProblem, 400);

  const captcha = await verifyTurnstile(captchaToken, request, "signup");
  if (!captcha.ok) return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });

  const supabase = createRouteClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl(request)}/auth/callback`,
      data: { full_name: fullName },
      captchaToken: forwardCaptchaToSupabase("signup") ? captchaToken : undefined,
    },
  });

  if (error) {
    if (/captcha/i.test(error.message)) {
      return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });
    }
    if (error.status === 429) return jsonError("Too many requests. Please wait and try again.", 429);
    if (/password/i.test(error.message)) return jsonError(error.message, 400);
    // "User already registered" etc. are not exposed (no account enumeration).
    console.error("signUp:", error.message);
  }

  // signUp may return a session when email confirmation is disabled; do not
  // keep it. Access starts at sign-in, which runs the provisioning checks.
  await supabase.auth.signOut();

  return NextResponse.json({ success: true, message: GENERIC });
}
