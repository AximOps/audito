import { getOrganizationSubscription } from "@/lib/subscription";

const CAPACITY_STATUSES = ["Active", "Inactive"] as const;

export async function getAssetUsage(
  supabase: any,
  organizationId: string,
) {
  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", [...CAPACITY_STATUSES]);

  if (error) throw new Error(error.message);

  const plan = await getOrganizationSubscription(organizationId);
  const limit = plan.limits.assets;
  const current = count ?? 0;

  return {
    current,
    limit,
    remaining: limit === null ? null : Math.max(limit - current, 0),
    plan: plan.code,
  };
}

export async function requireAssetCapacity(
  supabase: any,
  organizationId: string,
  amount = 1,
) {
  const usage = await getAssetUsage(supabase, organizationId);

  if (usage.limit !== null && usage.current + amount > usage.limit) {
    const error = new Error("Asset subscription limit reached.");
    Object.assign(error, {
      code: "PLAN_LIMIT_REACHED",
      resource: "assets",
      limit: usage.limit,
      current: usage.current,
      plan: usage.plan,
    });
    throw error;
  }

  return usage;
}
