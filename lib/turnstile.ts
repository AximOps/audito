import "server-only";

/**
 * Cloudflare Turnstile verification.
 *
 * TURNSTILE_MODE
 *   app      (default) - this server verifies the token with Cloudflare
 *                        (siteverify) before calling Supabase Auth.
 *   supabase           - Supabase Auth "Bot and Abuse Protection" is enabled
 *                        with the Turnstile secret; the token is forwarded as
 *                        captchaToken so Supabase verifies it. This also
 *                        protects direct calls to the Supabase Auth API made
 *                        with the public anon key. OAuth start is still
 *                        verified here because Supabase does not check
 *                        captcha on OAuth.
 *
 * Turnstile is enabled when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. If it is
 * enabled in app mode without TURNSTILE_SECRET_KEY, verification fails closed.
 */

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type CaptchaPurpose = "login" | "oauth" | "signup" | "forgot_password";

export function turnstileEnabled() {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}

export function turnstileMode(): "app" | "supabase" {
  return process.env.TURNSTILE_MODE === "supabase" ? "supabase" : "app";
}

/** Should this request forward the token to Supabase instead of verifying it? */
export function forwardCaptchaToSupabase(purpose: CaptchaPurpose) {
  return turnstileEnabled() && turnstileMode() === "supabase" && purpose !== "oauth";
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

export async function verifyTurnstile(
  token: unknown,
  request: Request,
  purpose: CaptchaPurpose
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (!turnstileEnabled()) return { ok: true };
  if (forwardCaptchaToSupabase(purpose)) return { ok: true };

  if (typeof token !== "string" || !token || token.length > 2048) {
    return { ok: false, reason: "missing-input-response" };
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not configured; rejecting request.");
    return { ok: false, reason: "missing-secret" };
  }

  const body = new URLSearchParams({ secret, response: token });
  const ip = clientIp(request);
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const result = (await response.json()) as {
      success: boolean;
      action?: string;
      hostname?: string;
      "error-codes"?: string[];
    };

    if (!result.success) {
      return { ok: false, reason: result["error-codes"]?.join(",") || "invalid" };
    }

    // The widget sets action=<form>; reject tokens minted for another form.
    // OAuth buttons live on the sign-in and sign-up forms and share their widget.
    const accepted = purpose === "oauth" ? ["oauth", "login", "signup"] : [purpose];
    if (result.action && !accepted.includes(result.action)) {
      return { ok: false, reason: "action-mismatch" };
    }

    const expectedHost = process.env.TURNSTILE_EXPECTED_HOSTNAME;
    if (expectedHost && result.hostname && result.hostname !== expectedHost) {
      return { ok: false, reason: "hostname-mismatch" };
    }

    return { ok: true };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { ok: false, reason: "verification-unavailable" };
  }
}
