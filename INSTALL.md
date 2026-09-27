# Installation

Copy the patch contents into the AuditOps project root and overwrite existing files when prompted.

Files:

- `app/assets/page.tsx`
- `app/api/assets/route.ts`
- `app/api/assets/[id]/route.ts`
- `app/api/assets/subscription/route.ts`
- `lib/assets-subscription.ts`

The existing subscription-plan files are intentionally not duplicated in this patch. Keep the versions from the previously supplied subscription-plan implementation.
