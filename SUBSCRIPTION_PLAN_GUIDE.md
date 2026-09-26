# AuditOps Subscription Plan Entitlements

The organization subscription is one of:

- FREE
- Standard
- Pro
- Enterprise

## FREE

For evaluation and very small compliance programs.

- 3 users
- 1 framework
- 25 active tasks
- 25 assets
- 10 vendors
- 10 policies
- 25 findings
- 25 vulnerabilities
- 1 GB evidence
- 30-day audit log retention
- Core compliance modules

## Standard

For active small/medium compliance programs.

- 10 users
- 2 frameworks
- 250 active tasks
- 250 assets
- 50 vendors
- 50 policies
- 250 findings
- 250 vulnerabilities
- 10 GB evidence
- 1-year audit log retention
- Recurring tasks
- Automated reminders

## Pro

For mature, multi-framework compliance programs.

- 50 users
- 5 frameworks
- 2,500 active tasks
- 2,500 assets
- 250 vendors
- 250 policies
- 2,500 findings
- 2,500 vulnerabilities
- 100 GB evidence
- 3-year audit log retention
- Advanced reporting
- Cross-framework mapping
- Custom fields
- Custom roles
- API
- Webhooks
- Data retention controls
- Scheduled reports
- Priority support

## Enterprise

For enterprise governance, security and scale.

- Custom/unlimited limits
- SAML SSO
- SCIM provisioning
- IP restrictions
- Multi-business-unit support
- Dedicated support
- All Pro capabilities

## Implementation

`organizations.subscription` stores the selected plan. The `subscription_plans` table is the database entitlement catalog, while `lib/subscription-plans.ts` is the application-side entitlement catalog used by feature gates and server-side checks.

Do not hard-code plan checks throughout the UI. Use `getSubscriptionPlan()`, `hasPlanFeature()` and `getPlanLimit()` so plan changes remain centralized.
