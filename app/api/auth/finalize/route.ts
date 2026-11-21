import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import { finalizeSignIn } from "@/lib/auth-finalize";
import { AUTH_ERROR_MESSAGES, safeNextPath } from "@/lib/auth-config";
import { clientIp } from "@/lib/turnstile";
import { jsonError, readJson, setActiveOrgCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

/**
 * Used by /auth/complete after an implicit-flow link (tokens in the URL
 * fragment) has been turned into a cookie session in the browser.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return jsonError(AUTH_ERROR_MESSAGES.session_error, 401);

  const result = await finalizeSignIn(user, { ip: clientIp(request) });

  if (result.status === "denied") {
    await supabase.auth.signOut();
    return jsonError(AUTH_ERROR_MESSAGES[result.reason] || AUTH_ERROR_MESSAGES.not_provisioned, 403, {
      code: result.reason,
    });
  }

  if (result.status === "pending") {
    return NextResponse.json({ success: true, redirectTo: "/auth/pending" });
  }

  const type = typeof body.type === "string" ? body.type : "";
  const redirectTo =
    type === "invite"
      ? "/auth/reset-password?mode=invite"
      : type === "recovery"
        ? "/auth/reset-password"
        : safeNextPath(body.next);

  const response = NextResponse.json({ success: true, organizationId: result.organizationId, redirectTo });
  return setActiveOrgCookie(response, result.organizationId);
}
