# Installation

1. Apply the previously supplied organization-management + subscription-plan patch.
2. Copy this patch over the existing AuditOps source tree.
3. Run the existing database migrations 007 and 008 if they have not already been applied.
4. Run `npm run build`.
5. Verify Users & Roles for FREE, Standard, Pro and Enterprise organizations.
6. Verify that inviting/adding a user at the plan limit returns `PLAN_LIMIT_REACHED` and does not create an Auth user or membership.

No new SQL migration is required for this patch.
