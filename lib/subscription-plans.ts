export type SubscriptionPlanCode = "FREE" | "Standard" | "Pro" | "Enterprise";

export type PlanLimit = number | null;

export type SubscriptionPlan = {
  code: SubscriptionPlanCode;
  name: string;
  description: string;
  limits: {
    users: PlanLimit;
    frameworks: PlanLimit;
    activeTasks: PlanLimit;
    assets: PlanLimit;
    vendors: PlanLimit;
    policies: PlanLimit;
    findings: PlanLimit;
    vulnerabilities: PlanLimit;
    evidenceGb: PlanLimit;
    auditLogDays: PlanLimit;
  };
  features: {
    recurringTasks: boolean;
    automatedReminders: boolean;
    advancedReporting: boolean;
    crossFrameworkMapping: boolean;
    customFields: boolean;
    customRoles: boolean;
    api: boolean;
    webhooks: boolean;
    ssoSaml: boolean;
    scim: boolean;
    ipRestrictions: boolean;
    dataRetentionControls: boolean;
    scheduledReports: boolean;
    multiBusinessUnits: boolean;
    prioritySupport: boolean;
    dedicatedSupport: boolean;
  };
};

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanCode, SubscriptionPlan> = {
  FREE: {
    code: "FREE",
    name: "FREE",
    description: "Explore AuditOps with a small compliance program.",
    limits: {
      users: 3,
      frameworks: 1,
      activeTasks: 25,
      assets: 25,
      vendors: 10,
      policies: 10,
      findings: 25,
      vulnerabilities: 25,
      evidenceGb: 1,
      auditLogDays: 30,
    },
    features: {
      recurringTasks: false,
      automatedReminders: false,
      advancedReporting: false,
      crossFrameworkMapping: false,
      customFields: false,
      customRoles: false,
      api: false,
      webhooks: false,
      ssoSaml: false,
      scim: false,
      ipRestrictions: false,
      dataRetentionControls: false,
      scheduledReports: false,
      multiBusinessUnits: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  Standard: {
    code: "Standard",
    name: "Standard",
    description: "Run an active compliance program for a small or medium organization.",
    limits: {
      users: 10,
      frameworks: 2,
      activeTasks: 250,
      assets: 250,
      vendors: 50,
      policies: 50,
      findings: 250,
      vulnerabilities: 250,
      evidenceGb: 10,
      auditLogDays: 365,
    },
    features: {
      recurringTasks: true,
      automatedReminders: true,
      advancedReporting: false,
      crossFrameworkMapping: false,
      customFields: false,
      customRoles: false,
      api: false,
      webhooks: false,
      ssoSaml: false,
      scim: false,
      ipRestrictions: false,
      dataRetentionControls: false,
      scheduledReports: false,
      multiBusinessUnits: false,
      prioritySupport: false,
      dedicatedSupport: false,
    },
  },
  Pro: {
    code: "Pro",
    name: "Pro",
    description: "Automate and scale a mature, multi-framework compliance program.",
    limits: {
      users: 50,
      frameworks: 5,
      activeTasks: 2500,
      assets: 2500,
      vendors: 250,
      policies: 250,
      findings: 2500,
      vulnerabilities: 2500,
      evidenceGb: 100,
      auditLogDays: 1095,
    },
    features: {
      recurringTasks: true,
      automatedReminders: true,
      advancedReporting: true,
      crossFrameworkMapping: true,
      customFields: true,
      customRoles: true,
      api: true,
      webhooks: true,
      ssoSaml: false,
      scim: false,
      ipRestrictions: false,
      dataRetentionControls: true,
      scheduledReports: true,
      multiBusinessUnits: false,
      prioritySupport: true,
      dedicatedSupport: false,
    },
  },
  Enterprise: {
    code: "Enterprise",
    name: "Enterprise",
    description: "Enterprise governance, security, integrations and scale.",
    limits: {
      users: null,
      frameworks: null,
      activeTasks: null,
      assets: null,
      vendors: null,
      policies: null,
      findings: null,
      vulnerabilities: null,
      evidenceGb: null,
      auditLogDays: null,
    },
    features: {
      recurringTasks: true,
      automatedReminders: true,
      advancedReporting: true,
      crossFrameworkMapping: true,
      customFields: true,
      customRoles: true,
      api: true,
      webhooks: true,
      ssoSaml: true,
      scim: true,
      ipRestrictions: true,
      dataRetentionControls: true,
      scheduledReports: true,
      multiBusinessUnits: true,
      prioritySupport: true,
      dedicatedSupport: true,
    },
  },
};

export const SUBSCRIPTION_PLAN_CODES = Object.keys(
  SUBSCRIPTION_PLANS
) as SubscriptionPlanCode[];

export function getSubscriptionPlan(
  value: string | null | undefined
): SubscriptionPlan {
  if (value && value in SUBSCRIPTION_PLANS) {
    return SUBSCRIPTION_PLANS[value as SubscriptionPlanCode];
  }
  return SUBSCRIPTION_PLANS.FREE;
}

export function hasPlanFeature(
  value: string | null | undefined,
  feature: keyof SubscriptionPlan["features"]
): boolean {
  return getSubscriptionPlan(value).features[feature];
}

export function getPlanLimit(
  value: string | null | undefined,
  limit: keyof SubscriptionPlan["limits"]
): PlanLimit {
  return getSubscriptionPlan(value).limits[limit];
}
