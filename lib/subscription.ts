import { createAdminClient } from "@/lib/admin";
import { getSubscriptionPlan, type SubscriptionPlan } from "@/lib/subscription-plans";

export async function getOrganizationSubscription(
  organizationId: string
): Promise<SubscriptionPlan> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("organizations")
    .select("subscription, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Organization not found.");

  return getSubscriptionPlan(data.subscription);
}
