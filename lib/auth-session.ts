import "server-only";
import { NextResponse } from "next/server";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth-config";

export function setActiveOrgCookie(response: NextResponse, organizationId: string | null) {
  if (!organizationId) return response;
  // Not httpOnly: the browser client reads it to send x-organization-id, and
  // it holds no secret. The database validates membership on every request.
  response.cookies.set({
    name: ACTIVE_ORG_COOKIE,
    value: organizationId,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function clearActiveOrgCookie(response: NextResponse) {
  response.cookies.set({ name: ACTIVE_ORG_COOKIE, value: "", path: "/", maxAge: 0 });
  return response;
}

export function jsonError(message: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
