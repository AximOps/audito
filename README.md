# AuditOps – Platform Admins Organizations-Style Management Template

## Purpose

Updates `app/platform/users/page.tsx` so the Platform Admins screen follows the same management template used by the Organizations screen.

## Included behavior

- Status is displayed as a badge rather than an inline dropdown.
- Active admins show **Edit**, **Suspend**, and **Remove** actions.
- Suspended admins show **Edit**, **Reactivate**, and **Remove** actions.
- Suspend and Remove use confirmation dialogs.
- Edit continues to use the existing `PlatformAdminEditDialog`.
- Existing Platform Admin APIs are retained; no database migration is required.
- Removing an admin continues to revoke Platform Admin access while retaining the underlying user account, consistent with the existing API behavior.

## Apply

Replace:

`app/platform/users/page.tsx`

with the included file.

No other files are required for this UI change.
