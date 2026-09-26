# AuditOps User Directory Fix v4

## Fixes
- Adds the missing `/platform/directory` User Directory implementation.
- Adds server APIs under `/api/platform/directory` for global user edit, suspend/enable, and removal of organization/platform access.
- User Directory edits `public.users` and synchronizes email changes with Supabase Auth.
- Suspend/enable changes the global application user status.
- Remove Access removes all `organization_memberships` and `platform_users` rows for the user but retains `public.users` and audit history.
- Fixes all Platform Admin route references to `platform_users.id`; the implementation now uses `platform_users.user_id`.
- Updates `server-auth.ts` so globally Suspended users cannot access AuditOps.

## No password field
AuditOps does not store or edit passwords. Supabase Auth remains the authentication engine.

## Expected navigation
Platform Admin > User Directory -> `/platform/directory`
Platform Admin > Platform Admins -> `/platform/users`
