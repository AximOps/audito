# AuditOps Users & Memberships — Subscription Enforcement Patch

This overlay adds server-side subscription enforcement for the **Users & Memberships** module.

## Included

- Central `lib/subscription-enforcement.ts` utility.
- FREE / Standard / Pro / Enterprise user limits from the existing subscription-plan model.
- User usage calculation based on organization memberships with `Active` or `Invited` membership status and application users with `Active` or `Invited` status.
- Server-side enforcement when adding an existing user or inviting a new user.
- `/api/users` now returns subscription usage information.
- Existing user-management UI updated to show plan usage and remaining capacity.
- `PLAN_LIMIT_REACHED` API responses with plan, current usage, and configured limit.

## Prerequisite

Apply the earlier organization/subscription patch first, including migrations 007 and 008, and ensure `public.organizations.subscription` is populated.

This patch does not add or modify database tables.

## User counting

The current organization user count includes memberships with status `Active` or `Invited` whose application-user status is `Active` or `Invited`. Suspended/disabled users do not consume the configured user capacity.

## Response behavior

When a new user would exceed the organization's plan limit, the API returns HTTP `402` with:

```json
{
  "code": "PLAN_LIMIT_REACHED",
  "resource": "users",
  "current": 3,
  "limit": 3,
  "plan": "FREE"
}
```

## Next modules

The same enforcement utility is designed to be reused for Tasks, Assets, Vendors, Policies, Findings, Vulnerabilities, Evidence, and Frameworks.
