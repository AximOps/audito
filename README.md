# AuditOps Phase 3 — Application-Managed User Directory

This package implements **Option A**:

- Supabase Auth remains the authentication engine.
- `public.users` becomes the AuditOps application user directory.
- `organization_memberships` remains the organization access/role source of truth.
- `platform_users` remains the platform-admin source of truth.
- User creation, invitation, profile changes, organization assignment, role changes, and status changes are performed through the AuditOps portal/server APIs.
- Passwords and authentication sessions remain managed by Supabase Auth.

## Apply in this order

1. Copy the files into the existing AuditOps project, preserving the existing Phase 1/Phase 2 files.
2. Add `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` to `.env.local`.
3. Run `database/migrations/006_application_user_directory.sql` in Supabase SQL Editor.
4. Confirm the migration succeeds before deploying the code.
5. Run `npm run build`.

## Portal capabilities added

### Organization Users & Roles

- Add Existing User
- Invite New User
- Edit name/job title
- Change organization role
- Change organization membership status
- One user can belong to multiple organizations

### Platform Administration

- Platform Admins page at `/platform/users`
- Add an existing AuditOps user as Platform Admin
- Invite a new Platform Admin
- Suspend/reactivate Platform Admin access

## Important environment variable

`SUPABASE_SERVICE_ROLE_KEY` must only be configured on the server/Vercel environment. Never expose it as a `NEXT_PUBLIC_*` variable.

## Migration safety

`user_profiles` is retained for compatibility with existing AuditOps code. New authorization and directory management use `users`, `organization_memberships`, and `platform_users`.
