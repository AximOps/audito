import "server-only";
import { createAdminClient } from "@/lib/admin";

export type AuditEntry = {
  organizationId?: string | null;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/** Best-effort audit write. Never throws: auditing must not break the flow. */
export async function writeAuditLog(entry: AuditEntry) {
  try {
    const admin = createAdminClient();
    const ip = entry.ipAddress && /^[0-9a-fA-F:.]+$/.test(entry.ipAddress) ? entry.ipAddress : null;
    const { error } = await admin.from("audit_logs").insert({
      organization_id: entry.organizationId || null,
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType || null,
      entity_id: entry.entityId || null,
      old_values: entry.oldValues || null,
      new_values: entry.newValues || null,
      ip_address: ip,
    });
    if (error) console.error("Audit log write failed:", error.message);
  } catch (error) {
    console.error("Audit log write failed:", error);
  }
}
