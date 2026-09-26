# AuditOps Platform Admin Editable Users

This patch adds editing for Platform Admin users and documents the intended
password/invitation behavior shown in the current Add Platform Admin UI.

## Add Platform Admin behavior

The Add Platform Admin form should continue to contain only:

- Email
- Full Name
- Job Title

There is intentionally NO password field.

AuditOps uses Supabase Auth as the authentication engine. For a new Platform
Admin, the server should create/invite the Auth user and send an invitation
or verification email. The user completes the authentication setup through
Supabase Auth. AuditOps must never store a plaintext password.

## Editable Platform Admin fields

The new Edit Platform Admin dialog supports:

- Email
- Full Name
- Job Title
- Status (Active / Suspended)

The Platform Admin role itself remains fixed on this screen.

## Files

`app/api/platform/admins/[id]/route.ts`
- GET Platform Admin details
- PATCH Platform Admin profile/status
- verifies active Platform Admin caller
- updates `public.users`
- updates `public.platform_users`
- synchronizes an email change with Supabase Auth
- never handles passwords

`components/platform-admin-edit-dialog.tsx`
- Edit Platform Admin modal

## Integrate into Platform Admin page

Import:

```tsx
import PlatformAdminEditDialog from "@/components/platform-admin-edit-dialog";
```

Add state:

```tsx
const [editingAdmin, setEditingAdmin] = useState<PlatformAdminRow | null>(null);
```

Add an Edit button to each Platform Admin row:

```tsx
<button
  type="button"
  onClick={() => setEditingAdmin(admin)}
  className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50"
>
  Edit
</button>
```

Render:

```tsx
{editingAdmin && (
  <PlatformAdminEditDialog
    user={{
      id: editingAdmin.id,
      email: editingAdmin.email,
      full_name: editingAdmin.full_name,
      job_title: editingAdmin.job_title,
      status:
        editingAdmin.status === "Suspended"
          ? "Suspended"
          : "Active",
    }}
    open={Boolean(editingAdmin)}
    onClose={() => setEditingAdmin(null)}
    onSaved={(updatedUser) => {
      setAdmins((current) =>
        current.map((admin) =>
          admin.id === updatedUser.id
            ? { ...admin, ...updatedUser }
            : admin
        )
      );
      setMessage("Platform Admin updated successfully.");
    }}
    onError={setError}
  />
)}
```

Adapt `setAdmins`, `setMessage`, `setError`, and the row type to match the
existing Platform Admin page.

## SQL

No new SQL migration is required for this feature if Phase 3 already has:

- `public.users`
- `public.platform_users`

The feature only uses existing columns:
- users.email
- users.full_name
- users.job_title
- users.status
- platform_users.user_id
- platform_users.role
- platform_users.status

## Email changes

Changing a Platform Admin email updates:

1. `public.users.email`
2. Supabase Auth email

The Auth email is set with `email_confirm: false`, so the new address must
complete the normal verification flow.

## Security

- Only an active Platform Admin can edit another Platform Admin.
- A Platform Admin cannot suspend their own account through this API.
- Service-role credentials are server-only.
- Passwords are never stored or edited by AuditOps.


## TypeScript build fix

The Auth user lookup explicitly types the fields used from `listUsers()`, preventing the `email does not exist on type never` TypeScript error.


## Additional TypeScript build fix

If the project's generated Supabase Database type does not yet contain
`public.users`, Supabase can infer a selected row as `never`. The route
therefore casts only the email field at the point where it is needed:

```ts
const applicationUserEmail =
  (appUser as { email: string }).email;
```

This does not change runtime behavior or database behavior. It only avoids
the stale/generated Supabase type causing the `email does not exist on type
never` build error.


## Comprehensive generated-type fix

The route now defines explicit `ApplicationUser` and `PlatformUser` shapes
for the fields used by this API. This prevents stale Supabase-generated
types from treating rows from `public.users` or `public.platform_users` as
`never`.

This is intentionally limited to TypeScript typing; it does not alter the
database schema or authentication behavior.


## Supabase client type compatibility fix

The `resolveTarget` helper accepts the server-side service-role client as an
untyped client because the current generated Supabase Database type in the
application has an incompatible generic signature (`never` for the schema).
The query results are still explicitly shaped as `ApplicationUser` and
`PlatformUser`.

This is a TypeScript compatibility fix only and does not change runtime
authorization, database access, or authentication behavior.
