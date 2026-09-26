# AuditOps Organization Management Patch

Adds Platform Administration organization management:

- Edit organization
- Suspend organization
- Reactivate organization
- Soft-remove organization
- Subscription plans: FREE, Standard, Pro, Enterprise
- Create Organization with subscription
- Platform Admin-only API authorization
- Organization lifecycle audit log entries
- Prevent suspended/removed organizations from being treated as active memberships

## Files

- `app/platform/organizations/page.tsx`
- `app/api/platform/organizations/route.ts`
- `app/api/platform/organizations/[id]/route.ts`
- `components/` (reserved for future shared organization UI)
- `lib/organization-plans.ts`
- `database/migrations/007_organization_management.sql`

## Installation

Copy the patch files into the current AuditOps project, preserving the paths, then run the SQL migration in Supabase.

The migration intentionally keeps the existing `organizations.plan` column for backward compatibility and synchronizes it with the new `subscription` field.

Organization removal is soft removal: data is retained and the organization status becomes `Removed`.

The API uses the existing AuditOps Phase 3 helpers:
- `getServerAuthContext()`
- `createAdminClient()`

No password or authentication changes are included.
