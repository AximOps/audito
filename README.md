# AuditOps Assets + Subscription Enforcement

Overlay patch for the Assets module.

## Included

- Full `/assets` CRUD-style UI for the existing `public.assets` table.
- `GET/POST /api/assets`.
- `PATCH/DELETE /api/assets/[id]`.
- `GET /api/assets/subscription` for plan usage.
- Server-side asset capacity enforcement using the existing subscription-plan foundation.
- Asset capacity counts `Active` and `Inactive` assets. `Retired` assets do not consume plan capacity.
- Plan limits are read from `getOrganizationSubscription()`; no hard-coded limits are duplicated in the Assets module.
- Existing Assets RBAC is preserved; write access is limited to Organization Admin, Security Manager, IT Manager and Contributor. Auditors remain read-only.

## Plan limits

The existing subscription-plan configuration is used:

- FREE: 25 assets
- Standard: 250 assets
- Pro: 2,500 assets
- Enterprise: unlimited

## Prerequisites

Apply the existing subscription-plan and multi-organization/server-auth work first. This patch expects:

- `lib/subscription.ts`
- `lib/subscription-plans.ts`
- `lib/server-auth.ts`
- `public.assets` with its existing schema
- `assets` permission in `lib/rbac.ts`

## Important

This patch replaces the current Assets scaffold with a working CRUD UI and APIs. It does not introduce a database migration because the `assets` table already exists in AuditOps.
