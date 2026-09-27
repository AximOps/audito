# AuditOps — User Directory Organization-Style UI Patch

This overlay updates `app/platform/directory/page.tsx` so the User Directory follows the same management template used by Platform Administration > Organizations.

## Changes

- Status is displayed as a badge instead of an inline select.
- Active users show **Edit / Suspend / Remove** actions.
- Suspended users show **Edit / Reactivate / Remove** actions.
- Edit opens the existing user-edit form in a modal.
- Suspend and Remove use confirmation dialogs, matching the Organizations workflow.
- Remove retains the application user record and audit history; the existing DELETE API remains responsible for removing organization memberships and platform access.
- Existing User Directory list API and `/api/platform/directory/[id]` PATCH/DELETE APIs are reused.
- No database migration is included.
- Add Existing and Invite User buttons are intentionally left unchanged; this patch only aligns the management/status UI.

## Apply

Replace:

`app/platform/directory/page.tsx`

with the file in this package.

## API expectations

The existing endpoint must support:

- `PATCH /api/platform/directory/[id]` with `{ status: "Active" | "Suspended" }`
- `PATCH /api/platform/directory/[id]` with `{ email, fullName, jobTitle }`
- `DELETE /api/platform/directory/[id]`

This matches the existing User Directory API from the previous AuditOps user-directory patch.
