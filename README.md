# AuditOps MVP

AuditOps is a compliance operations platform for managing activities, evidence, vulnerabilities, assets, access reviews, policies and audit readiness.

## Stack
- Next.js + TypeScript
- Tailwind CSS
- Supabase PostgreSQL/Auth/Storage
- PostgreSQL Row Level Security (RLS)

## Authentication + RBAC
- `/login` uses Supabase email/password authentication.
- Protected application routes require an authenticated Supabase user.
- `/settings/users` is visible only to Organization Admins.
- RBAC is enforced in the UI and by PostgreSQL RLS policies.
- Initial roles: Organization Admin, Compliance Manager, Security Manager, IT Manager, Contributor, Auditor / Read Only.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase URL and anon key.
4. For a fresh database, run `database/schema.sql` in Supabase SQL Editor. If you already installed the previous AuditOps MVP schema, run `database/migrations/001_rbac.sql` instead.
5. Create a user in Supabase Authentication.
6. Create an organization and matching `user_profiles` row for the user's auth UUID, with role `Organization Admin` for the first administrator.
7. `npm run dev`

User invitations and automated onboarding are intentionally deferred to the next pass.

## Latest task enhancements
Run `database/migrations/003_task_types.sql` after the activity categories migration. This adds organization-specific Task Types (Task, Change Request, Review), status/priority fields to the Task form, and Task detail/update support.


## Multi-Organization Upgrade

This version introduces the first phase of AuditOps multi-tenancy.

### Database migration

Run the following in Supabase SQL Editor after migrations 001, 002 and 003:

```text
database/migrations/004_multi_organization.sql
```

The migration is additive and preserves the existing `user_profiles.organization_id` field for compatibility.

It adds:

- `organization_memberships`
- `platform_users`
- organization `status`
- organization `plan`
- membership-aware `current_org_id()`
- platform/admin helper functions
- membership and platform RLS
- existing user membership backfill

### Platform administrator bootstrap

The migration intentionally does not automatically make an existing user a Platform Admin.

After the migration, explicitly assign the platform administrator in Supabase SQL Editor:

```sql
insert into public.platform_users (user_id, role, status)
select id, 'Platform Admin', 'Active'
from auth.users
where lower(email) = lower('YOUR-PLATFORM-ADMIN-EMAIL')
on conflict (user_id)
do update set role='Platform Admin', status='Active', updated_at=now();
```

### Organization context

The application stores the selected organization in browser storage and a secure server cookie. Supabase requests include the selected organization ID as `x-organization-id`. The database accepts that organization only when the authenticated user has an active membership.

### Important deployment sequence

1. Run migration `004_multi_organization.sql` in Supabase.
2. Bootstrap the Platform Admin.
3. Deploy this code to Vercel.
4. Log in and verify the Organization selector.
5. Verify the existing AuditOps Demo organization and data.
6. Create a second test organization.
7. Add a test membership to the second organization.
8. Switch organizations and verify that Tasks, Categories, Task Types and other organization-owned data remain isolated.

This phase intentionally keeps the legacy `user_profiles.organization_id` column so the application can be migrated incrementally without destroying existing data.
