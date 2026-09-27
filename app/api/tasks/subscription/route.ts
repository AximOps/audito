import { NextResponse } from "next/server";
import { getServerAuthContext } from "@/lib/server-auth";
import { getSubscriptionPlan } from "@/lib/subscription-plans";
import {
  getTaskSubscriptionUsage,
  requireTaskFeature,
} from "@/lib/task-subscription-enforcement";

export async function GET() {
  try {
    const { user, profile, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    const organizationId = profile?.organization_id;
    if (!organizationId) return NextResponse.json({ error: "No organization is selected." }, { status: 400 });
    const usage = await getTaskSubscriptionUsage(organizationId);
    const plan = getSubscriptionPlan(usage.plan);
    return NextResponse.json({
      usage,
      features: {
        recurringTasks: plan.features.recurringTasks,
        automatedReminders: plan.features.automatedReminders,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to load task subscription details." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile, error } = await getServerAuthContext();
    if (!user) return NextResponse.json({ error: error || "Unauthorized." }, { status: 401 });
    const organizationId = profile?.organization_id;
    if (!organizationId) return NextResponse.json({ error: "No organization is selected." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    const feature = body?.feature;
    if (feature !== "recurringTasks" && feature !== "automatedReminders") {
      return NextResponse.json({ error: "Invalid task subscription feature." }, { status: 400 });
    }
    await requireTaskFeature(organizationId, feature);
    return NextResponse.json({ allowed: true, feature });
  } catch (err) {
    const typed = err as { code?: string; message?: string; plan?: string; limit?: number | null; current?: number };
    if (typed.code === "SUBSCRIPTION_FEATURE_NOT_INCLUDED") {
      return NextResponse.json({
        error: typed.message,
        code: typed.code,
        plan: typed.plan,
        limit: typed.limit ?? null,
        current: typed.current ?? null,
      }, { status: 403 });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unable to validate task feature." }, { status: 500 });
  }
}
