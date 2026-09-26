import "server-only";

import { createAdminClient } from "@/lib/admin";
import { getPlanLimit, getSubscriptionPlan, type SubscriptionPlanCode } from "@/lib/subscription-plans";

export type SubscriptionLimitKey =
  | "users"
  | "frameworks"
  | "activeTasks"
  | "assets"
  | "vendors"
  | "policies"
  | "findings"
  | "vulnerabilities"
  | "evidenceGb"
  | "auditLogDays";

export class SubscriptionLimitError extends Error {
  readonly code = "PLAN_LIMIT_REACHED";
  readonly resource: SubscriptionLimitKey;
  readonly limit: number;
  readonly current: number;
  readonly plan: SubscriptionPlanCode;

  constructor(resource: SubscriptionLimitKey, limit: number, current: number, plan: SubscriptionPlanCode) {
    super(`The ${plan} plan allows up to ${limit} ${resource}. Current usage is ${current}.`);
    this.name = "SubscriptionLimitError";
    this.resource = resource;
    this.limit = limit;
    this.current = current;
    this.plan = plan;
  }
}

export function isSubscriptionLimitError(error: unknown): error is SubscriptionLimitError {
  return error instanceof SubscriptionLimitError;
}

export async function getOrganizationPlan(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("subscription,status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organization not found.");

  return getSubscriptionPlan(data.subscription);
}

export async function getOrganizationUserUsage(organizationId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("organization_memberships")
    .select("id,users!inner(id,status)", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", ["Active", "Invited"])
    .in("users.status", ["Active", "Invited"]);

  if (error) throw new Error(error.message);

  const plan = await getOrganizationPlan(organizationId);
  const limit = getPlanLimit(plan.code, "users");
  const current = count ?? 0;

  return {
    plan: plan.code,
    planName: plan.name,
    resource: "users" as const,
    current,
    limit,
    remaining: limit === null ? null : Math.max(limit - current, 0),
    atLimit: limit !== null && current >= limit,
  };
}

export async function requireWithinPlanLimit(
  organizationId: string,
  resource: SubscriptionLimitKey,
  projectedUsage: number
) {
  const plan = await getOrganizationPlan(organizationId);
  const limit = getPlanLimit(plan.code, resource);

  if (limit !== null && projectedUsage > limit) {
    throw new SubscriptionLimitError(resource, limit, projectedUsage, plan.code);
  }

  return { plan, limit };
}

export async function requireFeature(
  organizationId: string,
  feature: keyof ReturnType<typeof getSubscriptionPlan>["features"]
) {
  const plan = await getOrganizationPlan(organizationId);
  if (!plan.features[feature]) {
    const error = new Error(`The ${plan.name} plan does not include the ${feature} feature.`);
    error.name = "SUBSCRIPTION_FEATURE_NOT_INCLUDED";
    throw error;
  }
  return plan;
}
