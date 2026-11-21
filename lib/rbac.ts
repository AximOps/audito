/**
 * AuditOps role-based access control.
 *
 * Single source of truth for the application layer. The matrix below mirrors
 * the Row Level Security policies in database/migrations/001_rbac.sql and
 * 002/003 (task categories / types). RLS stays the final enforcement point;
 * this file drives navigation, page gating (middleware), API checks and UI
 * affordances so they never disagree with the database.
 *
 * Edge-runtime safe: no Node or Supabase imports.
 */

export type Role =
  | "Organization Admin"
  | "Compliance Manager"
  | "Security Manager"
  | "IT Manager"
  | "Contributor"
  | "Auditor / Read Only";

export const ROLE_OPTIONS: readonly Role[] = [
  "Organization Admin",
  "Compliance Manager",
  "Security Manager",
  "IT Manager",
  "Contributor",
  "Auditor / Read Only",
];

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  "Organization Admin": "Full access, manages users, roles and organization settings.",
  "Compliance Manager": "Owns tasks, evidence, policies, vendors and task settings.",
  "Security Manager": "Owns vulnerabilities, assets, access reviews and exceptions.",
  "IT Manager": "Maintains assets, vulnerabilities and access reviews.",
  Contributor: "Works on assigned tasks, evidence, assets and findings.",
  "Auditor / Read Only": "Read-only access to audit-relevant modules.",
};

export type PlatformRole = "Platform Admin" | "Platform Support";

export type Permission =
  | "dashboard"
  | "activities"
  | "evidence"
  | "policies"
  | "vulnerabilities"
  | "assets"
  | "accessReviews"
  | "findings"
  | "exceptions"
  | "vendors"
  | "reports"
  | "users"
  | "auditLog"
  | "activityCategories"
  | "taskTypes"
  | "taskCategories"
  | "authSettings";

export type Action = "read" | "create" | "update" | "delete";

const ALL = ROLE_OPTIONS;
const ADMIN: readonly Role[] = ["Organization Admin"];
const ADMIN_CM: readonly Role[] = ["Organization Admin", "Compliance Manager"];
const COMPLIANCE_WRITERS: readonly Role[] = ["Organization Admin", "Compliance Manager", "Contributor"];
const SECURITY_WRITERS: readonly Role[] = ["Organization Admin", "Security Manager", "IT Manager", "Contributor"];
const SECURITY_DELETERS: readonly Role[] = ["Organization Admin", "Security Manager", "IT Manager"];

/** Action-level matrix. `read` doubles as "can open the module". */
export const ACCESS_MATRIX: Record<Permission, Record<Action, readonly Role[]>> = {
  dashboard: { read: ALL, create: [], update: [], delete: [] },

  activities: {
    read: ["Organization Admin", "Compliance Manager", "Contributor", "Auditor / Read Only"],
    create: COMPLIANCE_WRITERS,
    update: COMPLIANCE_WRITERS,
    delete: ADMIN_CM,
  },
  evidence: {
    read: ["Organization Admin", "Compliance Manager", "Contributor", "Auditor / Read Only"],
    create: COMPLIANCE_WRITERS,
    update: COMPLIANCE_WRITERS,
    delete: ADMIN_CM,
  },
  policies: {
    read: ["Organization Admin", "Compliance Manager", "Auditor / Read Only"],
    create: ADMIN_CM,
    update: ADMIN_CM,
    delete: ADMIN,
  },
  vulnerabilities: {
    read: [...SECURITY_WRITERS, "Auditor / Read Only"],
    create: SECURITY_WRITERS,
    update: SECURITY_WRITERS,
    delete: SECURITY_DELETERS,
  },
  assets: {
    read: [...SECURITY_WRITERS, "Auditor / Read Only"],
    create: SECURITY_WRITERS,
    update: SECURITY_WRITERS,
    delete: SECURITY_DELETERS,
  },
  accessReviews: {
    read: [...SECURITY_WRITERS, "Auditor / Read Only"],
    create: SECURITY_WRITERS,
    update: SECURITY_WRITERS,
    delete: SECURITY_DELETERS,
  },
  findings: {
    read: ALL,
    create: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager", "Contributor"],
    update: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager", "Contributor"],
    delete: ["Organization Admin", "Compliance Manager", "Security Manager"],
  },
  exceptions: {
    read: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager", "Auditor / Read Only"],
    create: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager"],
    update: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager"],
    delete: ADMIN_CM,
  },
  vendors: {
    read: ["Organization Admin", "Compliance Manager", "Auditor / Read Only"],
    create: ADMIN_CM,
    update: ADMIN_CM,
    delete: ADMIN,
  },
  reports: {
    read: ["Organization Admin", "Compliance Manager", "Security Manager", "IT Manager", "Auditor / Read Only"],
    create: [],
    update: [],
    delete: [],
  },
  users: { read: ADMIN, create: ADMIN, update: ADMIN, delete: ADMIN },
  authSettings: { read: ADMIN, create: [], update: ADMIN, delete: [] },
  auditLog: {
    read: ["Organization Admin", "Compliance Manager", "Auditor / Read Only"],
    create: [],
    update: [],
    delete: [],
  },
  // Task categories (legacy name: activityCategories) and task types.
  activityCategories: { read: ADMIN_CM, create: ADMIN_CM, update: ADMIN_CM, delete: ADMIN },
  taskCategories: { read: ADMIN_CM, create: ADMIN_CM, update: ADMIN_CM, delete: ADMIN },
  taskTypes: { read: ADMIN_CM, create: ADMIN_CM, update: ADMIN_CM, delete: ADMIN },
};

/** Backward-compatible module-level view (read access). */
export const PERMISSIONS: Record<Permission, readonly Role[]> = Object.fromEntries(
  Object.entries(ACCESS_MATRIX).map(([key, value]) => [key, value.read])
) as Record<Permission, readonly Role[]>;

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLE_OPTIONS.includes(value as Role);
}

export function rolesFor(permission: Permission, action: Action = "read"): readonly Role[] {
  return ACCESS_MATRIX[permission][action];
}

/** Module access (read). */
export function can(role: string | null | undefined, permission: Permission): boolean {
  return canDo(role, permission, "read");
}

/** Action-level access. */
export function canDo(
  role: string | null | undefined,
  permission: Permission,
  action: Action
): boolean {
  if (!role || !isRole(role)) return false;
  return ACCESS_MATRIX[permission][action].includes(role);
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "Organization Admin";
}

export function isReadOnly(role: string | null | undefined): boolean {
  return role === "Auditor / Read Only";
}

export function canManageUsers(role: string | null | undefined): boolean {
  return canDo(role, "users", "update");
}

export function canWrite(role: string | null | undefined): boolean {
  return !!role && isRole(role) && role !== "Auditor / Read Only";
}

export function isPlatformAdmin(platformRole: string | null | undefined): boolean {
  return platformRole === "Platform Admin";
}

/**
 * Route-level gating used by middleware. First matching prefix wins.
 * `platform: true` requires an active Platform Admin.
 */
export const ROUTE_RULES: ReadonlyArray<{
  prefix: string;
  permission?: Permission;
  platform?: boolean;
}> = [
  { prefix: "/platform", platform: true },
  { prefix: "/api/platform", platform: true },
  { prefix: "/settings/users", permission: "users" },
  { prefix: "/settings/authentication", permission: "authSettings" },
  { prefix: "/settings/task-types", permission: "taskTypes" },
  { prefix: "/settings/activity-categories", permission: "taskCategories" },
  { prefix: "/activities", permission: "activities" },
  { prefix: "/evidence", permission: "evidence" },
  { prefix: "/policies", permission: "policies" },
  { prefix: "/vulnerabilities", permission: "vulnerabilities" },
  { prefix: "/assets", permission: "assets" },
  { prefix: "/access-reviews", permission: "accessReviews" },
];

export function routeRuleFor(pathname: string) {
  return ROUTE_RULES.find(
    (rule) => pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)
  );
}
