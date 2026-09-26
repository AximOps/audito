export const ORGANIZATION_SUBSCRIPTIONS = [
  "FREE",
  "Standard",
  "Pro",
  "Enterprise",
] as const;

export type OrganizationSubscription =
  (typeof ORGANIZATION_SUBSCRIPTIONS)[number];

export const ORGANIZATION_STATUSES = [
  "Active",
  "Suspended",
  "Pending",
  "Removed",
] as const;

export type OrganizationStatus =
  (typeof ORGANIZATION_STATUSES)[number];
