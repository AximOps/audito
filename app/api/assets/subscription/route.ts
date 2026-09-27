import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { getAssetUsage } from "@/lib/assets-subscription";

export async function GET() {
  const auth = await getServerAuthContext();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || "Unauthorized." }, { status: 401 });
  if (!auth.organization) return NextResponse.json({ error: "No active organization selected." }, { status: 400 });

  try {
    return NextResponse.json(await getAssetUsage(auth.supabase, auth.organization.id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load asset subscription usage." }, { status: 500 });
  }
}
