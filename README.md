# AuditOps Organization Management + Subscription Plans

This overlay adds organization lifecycle management and centralized subscription entitlements.

## Organization management

- Edit organization name, slug, subscription, timezone, industry and status.
- Suspend active organizations.
- Reactivate suspended organizations.
- Soft-remove organizations. Compliance data and audit history are retained.
- Platform Admin authorization is enforced server-side.
- Organization changes are written to `audit_logs`.

## Subscription plans

- FREE
- Standard
- Pro
- Enterprise

The subscription catalog includes limits and feature entitlements for users, frameworks, tasks, assets, vendors, policies, findings, vulnerabilities, evidence, audit logs, API, webhooks, SSO, SCIM and enterprise capabilities.

## Installation

1. Apply `database/migrations/007_organization_management.sql` if it has not already been applied.
2. Apply `database/migrations/008_subscription_plans.sql`.
3. Copy the `app`, `components`, and `lib` files into the existing AuditOps project.
4. Keep your existing `server-auth` and admin client implementations.
5. Build and deploy.

`organizations.subscription` remains the organization's selected plan. The `subscription_plans` table is the database catalog of plan entitlements.
