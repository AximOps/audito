import "server-only";

import { createAdminClient } from "@/lib/admin";
import {
  getPlanLimit,
  getSubscriptionPlan,
  hasPlanFeature,
  type SubscriptionPlanCode,
} from "@/lib/subscription-plans";

export const ACTIVE_TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Pending Review",
  "Overdue",
] as const;

export type TaskFeature = "recurringTasks" | "automatedReminders";

export class TaskSubscriptionError extends Error {
  readonly code: "PLAN_LIMIT_REACHED" | "SUBSCRIPTION_FEATURE_NOT_INCLUDED";
  readonly resource = "activeTasks" as const;
  readonly plan: SubscriptionPlanCode;
  readonly limit: number | null;
  readonly current?: number;

  constructor(args: {
    code: "PLAN_LIMIT_REACHED" | "SUBSCRIPTION_FEATURE_NOT_INCLUDED";
    plan: SubscriptionPlanCode;
    limit: number | null;
    current?: number;
    message: string;
  }) {
    super(args.message);
    this.name = "TaskSubscriptionError";
    this.code = args.code;
    this.plan = args.plan;
    this.limit = args.limit;
    this.current = args.current;
  }
}

export async function getTaskSubscriptionUsage(organizationId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("compliance_activities")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("status", [...ACTIVE_TASK_STATUSES]);

  if (error) throw new Error(error.message);

  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("subscription,status")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) throw new Error(organizationError.message);
  if (!organization) throw new Error("Organization not found.");

  const plan = getSubscriptionPlan(organization.subscription);
  const limit = getPlanLimit(plan.code, "activeTasks");
  const current = count ?? 0;

  return {
    plan: plan.code,
    planName: plan.name,
    resource: "activeTasks" as const,
    current,
    limit,
    remaining: limit === null ? null : Math.max(limit - current, 0),
    atLimit: limit !== null && current >= limit,
  };
}

export async function requireTaskCapacity(
  organizationId: string,
  additionalTasks = 1
) {
  const usage = await getTaskSubscriptionUsage(organizationId);
  const projected = usage.current + Math.max(additionalTasks, 0);

  if (usage.limit !== null && projected > usage.limit) {
    throw new TaskSubscriptionError({
      code: "PLAN_LIMIT_REACHED",
      plan: usage.plan,
      limit: usage.limit,
      current: usage.current,
      message: `The ${usage.planName} plan allows up to ${usage.limit} active tasks. Current usage is ${usage.current}.`,
    });
  }

  return usage;
}

export async function requireTaskFeature(
  organizationId: string,
  feature: TaskFeature
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("subscription,status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organization not found.");

  const plan = getSubscriptionPlan(data.subscription);
  if (!hasPlanFeature(plan.code, feature)) {
    throw new TaskSubscriptionError({
      code: "SUBSCRIPTION_FEATURE_NOT_INCLUDED",
      plan: plan.code,
      limit: null,
      message: `The ${plan.name} plan does not include ${feature}.`,
    });
  }

  return plan;
}

export function taskSubscriptionErrorResponse(error: unknown) {
  if (!(error instanceof TaskSubscriptionError)) return null;

  const status =
    error.code === "PLAN_LIMIT_REACHED" ? 402 : 403;

  return {
    status,
    body: {
      error: error.message,
      code: error.code,
      resource: error.resource,
      plan: error.plan,
      limit: error.limit,
      current: error.current ?? null,
    },
  };
}
