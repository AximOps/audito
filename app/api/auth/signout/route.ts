import { NextResponse } from "next/server";
import { createRouteClient } from "@/lib/supabase-server";
import { writeAuditLog } from "@/lib/audit";
import { clientIp } from "@/lib/turnstile";
import { clearActiveOrgCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.auth.signOut();

  if (user) {
    await writeAuditLog({
      userId: user.id,
      action: "AUTH_SIGN_OUT",
      entityType: "user",
      entityId: user.id,
      ipAddress: clientIp(request),
    });
  }

  return clearActiveOrgCookie(NextResponse.json({ success: true }));
}
