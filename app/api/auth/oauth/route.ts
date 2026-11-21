import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import {
  AUTH_ERROR_MESSAGES,
  isOAuthProvider,
  isProviderEnabled,
  safeNextPath,
  siteUrl,
} from "@/lib/auth-config";
import { verifyTurnstile } from "@/lib/turnstile";
import { jsonError, readJson } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/**
 * Starts Google / Microsoft sign-in. Runs server-side so the Turnstile token
 * is verified before the provider redirect, and the PKCE code verifier is
 * stored in a cookie that /auth/callback reads.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const provider = body.provider;

  if (!isOAuthProvider(provider)) return jsonError("Unsupported provider.", 400);
  if (!isProviderEnabled(provider)) return jsonError(AUTH_ERROR_MESSAGES.provider_disabled, 403);

  const captcha = await verifyTurnstile(body.captchaToken, request, "oauth");
  if (!captcha.ok) return jsonError(AUTH_ERROR_MESSAGES.captcha_failed, 400, { code: "captcha_failed" });

  const next = safeNextPath(body.next);
  const redirectTo = `${siteUrl(request)}/auth/callback?provider=${provider}&next=${encodeURIComponent(next)}`;

  const supabase = createRouteClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      // Microsoft requires the email scope for Supabase to receive an address.
      scopes: provider === "azure" ? "openid email profile offline_access" : undefined,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error || !data.url) {
    return jsonError(error?.message || "Unable to start sign-in.", 400);
  }

  return NextResponse.json({ url: data.url });
}
