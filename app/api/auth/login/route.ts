import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import { finalizeSignIn } from "@/lib/auth-finalize";
import { AUTH_ERROR_MESSAGES, authMethods, safeNextPath } from "@/lib/auth-config";
import { clientIp, forwardCaptchaToSupabase, verifyTurnstile } from "@/lib/turnstile";
import { jsonError, readJson, setActiveOrgCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

// Generic message: never reveal whether the email exists.
const INVALID = "Invalid email or password.";

export async function POST(request: Request) {
  if (!authMethods.email) return jsonError(AUTH_ERROR_MESSAGES.provider_disabled, 403);

  const body = await readJson(request);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : undefined;

  if (!email || !password || email.length > 320 || password.length > 512) {
    return jsonError(INVALID, 400);
  }

  const captcha = await verifyTurnstile(captchaToken, request, "login");
  if (!captcha.ok) return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });

  const supabase = createRouteClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: forwardCaptchaToSupabase("login") ? { captchaToken } : undefined,
  });

  if (error || !data.user) {
    const message = error?.message || "";
    if (/captcha/i.test(message)) {
      return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });
    }
    if (/email not confirmed/i.test(message)) {
      return jsonError(AUTH_ERROR_MESSAGES.email_unverified, 403, { code: "email_unverified" });
    }
    if (error?.status === 429) return jsonError("Too many attempts. Please wait and try again.", 429);
    return jsonError(INVALID, 401);
  }

  const result = await finalizeSignIn(data.user, { provider: "email", ip: clientIp(request) });

  if (result.status === "denied") {
    await supabase.auth.signOut();
    return jsonError(AUTH_ERROR_MESSAGES[result.reason] || AUTH_ERROR_MESSAGES.not_provisioned, 403, {
      code: result.reason,
    });
  }

  if (result.status === "pending") {
    return NextResponse.json({ success: true, redirectTo: "/auth/pending" });
  }

  const response = NextResponse.json({
    success: true,
    organizationId: result.organizationId,
    redirectTo: safeNextPath(body.next),
  });
  return setActiveOrgCookie(response, result.organizationId);
}
