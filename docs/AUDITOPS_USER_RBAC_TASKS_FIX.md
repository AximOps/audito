# AuditOps – User Directory + Tasks/RBAC Fix

## What this patch fixes

### 1. User Directory
- Adds an Actions menu to organization users.
- Edit User remains available for full name, job title and organization role.
- Suspend / Enable user membership.
- Remove user from the current organization without deleting the global AuditOps user.
- Prevents an administrator from suspending/removing their own membership.
- Records organization-user removal in `audit_logs`.

### 2. Platform Admin Directory
- Adds Edit Platform Admin action.
- Adds Suspend / Enable action.
- Adds Remove Admin Access action.
- Removing Platform Admin access does **not** delete the user's AuditOps account.
- Prevents a Platform Admin from removing their own Platform Admin access.
- Existing Platform Admin edit dialog does not contain a password field.

### 3. Tasks / Task Types / Task Categories authorization
- Adds explicit `taskTypes` and `taskCategories` permissions to RBAC.
- Keeps `activityCategories` for backward compatibility.
- Corrects the navigation permissions for Task Types and Task Categories.
- Uses membership-aware `getServerAuthContext()` in Task Type and Task Category APIs instead of the legacy `user_profiles.role` / `user_profiles.organization_id` source.
- Platform Admins receive Organization Admin-level UI access while operating in an active organization.

## Files to overwrite

Copy the files in this package over the corresponding files in the AuditOps project.

## Database migration

No new SQL migration is required for this patch. It assumes the existing multi-organization and application-user-directory migrations are already applied, including the membership-based `current_org_id()` and `current_user_role()` functions.

## Important behavior

A user being removed from an organization is not deleted globally. Their `public.users` record, Supabase Auth account and historical audit records remain available. A Platform Admin can remove Platform Admin access without deleting the user account.

## Verification after deployment

1. Sign in as an Organization Admin.
2. Confirm **Tasks**, **Task Types**, and **Task Categories** are visible and no longer show Access denied.
3. Open User Directory and verify the `⋮` Actions menu.
4. Edit a user's name/job title.
5. Suspend and re-enable a test user.
6. Remove a test user from the organization and verify the global user remains in the platform directory.
7. Open Platform Admins and verify Edit, Suspend/Enable, and Remove Admin Access.
8. Verify you cannot suspend/remove your own account.
9. Run `npm run build` before pushing to Vercel.
10. If the browser still shows the old authorization result, sign out/in and hard-refresh after deployment so the current organization context is reloaded.


## Build fix v2
The Platform Admin edit dialog now accepts the database/API status as a string and normalizes it to Active/Suspended internally. This resolves the Next.js type error where `AdminRow.user.status` was inferred as `string`.
