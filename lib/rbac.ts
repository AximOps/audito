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
  | "activityCategories";

export const PERMISSIONS: Record<Permission, readonly Role[]> = {
  dashboard: ROLE_OPTIONS,

  activities: [
    "Organization Admin",
    "Compliance Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  evidence: [
    "Organization Admin",
    "Compliance Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  policies: [
    "Organization Admin",
    "Compliance Manager",
    "Auditor / Read Only",
  ],

  vulnerabilities: [
    "Organization Admin",
    "Security Manager",
    "IT Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  assets: [
    "Organization Admin",
    "Security Manager",
    "IT Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  accessReviews: [
    "Organization Admin",
    "Security Manager",
    "IT Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  findings: [
    "Organization Admin",
    "Compliance Manager",
    "Security Manager",
    "IT Manager",
    "Contributor",
    "Auditor / Read Only",
  ],

  exceptions: [
    "Organization Admin",
    "Compliance Manager",
    "Security Manager",
    "IT Manager",
    "Auditor / Read Only",
  ],

  vendors: [
    "Organization Admin",
    "Compliance Manager",
    "Auditor / Read Only",
  ],

  reports: [
    "Organization Admin",
    "Compliance Manager",
    "Security Manager",
    "IT Manager",
    "Auditor / Read Only",
  ],

  users: [
    "Organization Admin",
  ],

  activityCategories: [
    "Organization Admin",
    "Compliance Manager",
  ],

  auditLog: [
    "Organization Admin",
    "Compliance Manager",
    "Auditor / Read Only",
  ],
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    ROLE_OPTIONS.includes(value as Role)
  );
}

export function can(
  role: string | null | undefined,
  permission: Permission
): boolean {
  if (!role || !isRole(role)) {
    return false;
  }

  return PERMISSIONS[permission].includes(role);
}

export function isAdmin(
  role: string | null | undefined
): boolean {
  return role === "Organization Admin";
}

export function isReadOnly(
  role: string | null | undefined
): boolean {
  return role === "Auditor / Read Only";
}

export function canManageUsers(
  role: string | null | undefined
): boolean {
  return isAdmin(role);
}

export function canWrite(
  role: string | null | undefined
): boolean {
  return !!role && role !== "Auditor / Read Only";
}