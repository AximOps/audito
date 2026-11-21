# Authentication & Access Setup

AuditOps signs people in with **email/password**, **Google** or **Microsoft (Entra ID)**, through Supabase Auth.
**Cloudflare Turnstile** protects every sign-in form. AuditOps keeps its own user directory (`public.users`) and
the per-organization roles (`organization_memberships`). Nobody gets in just by having a Google or Microsoft account.

## 1. Database

Run `database/migrations/009_auth_providers_rbac_hardening.sql` after 008 (SQL editor, or `psql -f`).
The migration is idempotent. It adds:

| Change | Why |
|---|---|
| `users.status` gets `Pending` | Self-registered users waiting for approval |
| `users.auth_providers`, `last_login_provider`, `approved_at/by` | Shows which sign-in methods each user has |
| `organization_email_domains` (domain = primary key) | Verified-domain auto-join with a default role |
| Trigger `protect_user_directory_columns` | **Security fix:** users could set their own `status` (Suspended → Active) |
| Trigger `protect_last_org_admin` | Stops the last Organization Admin from being demoted or removed |
| `audit_logs.user_id` → `public.users` | Audit inserts failed for users with no legacy profile |
| `get_access_context()` | One RPC used by middleware for route-level RBAC |

For a fresh install, run `database/schema.sql` first. It failed on fresh databases before this change because
`has_role` was used before it was defined. Then run migrations 002–009 (001 is only for upgrading old installs).

Bootstrap the first Platform Admin once:

```sql
insert into public.platform_users (user_id, role)
select id, 'Platform Admin' from public.users where email = 'you@company.com'
on conflict (user_id) do update set role = 'Platform Admin', status = 'Active';
```

## 2. Environment

Copy `.env.example` to `.env.local` (Vercel: Project → Settings → Environment Variables).
The `NEXT_PUBLIC_*` values are read at **build time**, so redeploy after you change them.

## 3. Supabase Auth → URL Configuration

- **Site URL**: `https://<your-domain>`
- **Redirect URLs** (add the localhost versions for development):
  - `https://<your-domain>/auth/callback**`
  - `https://<your-domain>/auth/confirm**`
  - `https://<your-domain>/auth/reset-password**`

## 4. Google

1. Google Cloud Console → APIs & Services → Credentials → **Create OAuth client ID** (Web application).
2. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Supabase → Auth → Providers → **Google**: paste the Client ID and Secret, then enable it.
4. Set `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED=true`.

## 5. Microsoft (Entra ID / Azure)

1. Entra admin center → App registrations → **New registration**.
   - Single-tenant (your company only) or multi-tenant, as needed.
   - Redirect URI (Web): `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Certificates & secrets → new client secret. Copy the **Value**.
3. Token configuration → add the optional claims `email` and `xms_edov` (email-domain-owner-verified) to the ID token,
   so Supabase only treats verified addresses as verified.
4. Supabase → Auth → Providers → **Azure**: Client ID (Application ID), Secret, and
   **Azure Tenant URL** `https://login.microsoftonline.com/<tenant-id>` for single-tenant. Enable it.
5. Set `NEXT_PUBLIC_AUTH_MICROSOFT_ENABLED=true`.

The app requests the `openid email profile offline_access` scopes. Without `email`, Supabase receives no address
and sign-in is refused with `email_missing`.

**Account linking:** Supabase links identities that share the same *verified* email. A user invited as
`jane@acme.com` can therefore use her password, Google or Microsoft account. The Users & Roles page shows which
methods she has used.

## 6. Cloudflare Turnstile

1. Cloudflare dashboard → Turnstile → **Add widget**. Add your production and preview hostnames. Mode: *Managed*.
2. `NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>`, `TURNSTILE_SECRET_KEY=<secret>`.
3. Pick who verifies tokens:
   - **`TURNSTILE_MODE=supabase` (recommended).** Supabase → Auth → Attack Protection → enable CAPTCHA, provider
     Turnstile, same secret. Supabase then rejects password sign-in, sign-up and password reset calls that have no
     valid token, **including direct calls to the Supabase API with the public anon key**. App-only checks cannot
     stop those calls. The OAuth start is still verified by the app, because Supabase does not check CAPTCHA on OAuth.
   - **`TURNSTILE_MODE=app`.** The app's `/api/auth/*` routes verify the token with Cloudflare `siteverify`.
     Simpler to set up, but someone holding the anon key can still call Supabase Auth directly.
4. Optional: `TURNSTILE_EXPECTED_HOSTNAME=audit.example.com`.

Cloudflare test keys for local development: site key `1x00000000000000000000AA`, secret
`1x0000000000000000000000000000000AA` (always pass). Leave the site key empty to turn the widget off.

The CSP in `next.config.js` already allows `challenges.cloudflare.com`.

## 7. Email templates (recommended)

The default Supabase templates send implicit-flow links: the tokens travel in the URL fragment. These still work,
because `/auth/callback` forwards the fragment to `/auth/complete`. For server-side verification that also works
across devices, change the templates under Supabase → Auth → Email Templates:

| Template | Link |
|---|---|
| Invite user | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite` |
| Reset password | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery` |
| Confirm signup | `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup` |

Invited users then pick a password on `/auth/reset-password?mode=invite`.

Also set Supabase → Auth → Providers → Email → **Minimum password length to 10** and require letters, digits and
symbols, to match `lib/password-policy.ts`.

## 8. Who can get in

Every successful authentication goes through `lib/auth-finalize.ts`:

1. Directory status `Disabled` or `Suspended` → refused. The session is cleared and the attempt is audit-logged.
2. `Invited` → activated, together with the invited memberships.
3. No membership: if a Platform Admin has assigned the user's **verified** email domain to an organization, the
   provider is allowed for that domain, auto-join is on and the plan has seats → the user joins with the domain's
   default role.
4. Otherwise `AUTH_UNKNOWN_USER_POLICY`:
   - `deny` (default): refused, and the Auth account just created is deleted.
   - `pending`: a `Pending` directory record is kept and the user sees `/auth/pending`. An Organization Admin
     grants access with **Users & Roles → Add Existing User**, which also activates the account.

Domains are assigned only by Platform Admins (**Platform → Email Domains**). Each domain belongs to one
organization, and public mail domains (gmail.com, outlook.com and so on) are rejected. Otherwise an
Organization Admin could claim another company's domain and capture its new users. Organization Admins can
change auto-join, the default role and the allowed methods for their own domains under
**Administration → Sign-in & Access**.

## 9. Roles

`lib/rbac.ts` holds the matrix (read / create / update / delete per module). It matches the RLS policies, which
was checked against `001_rbac.sql`. The matrix is used in four places:

- **Middleware**: page gating (`ROUTE_RULES`); `/platform/*` requires an active Platform Admin.
- **API routes**: `rolesFor()` / `requireAccess()`.
- **Navigation and UI**: `can()` / `canDo()`.
- **Database RLS**: the final enforcement point.

Platform Admin is a platform role. Inside an organization, the membership role decides what a Platform Admin can
do, because that is what RLS evaluates. The Sign-in & Access page shows the full matrix.

## 10. Test checklist

- [ ] Password sign-in with Turnstile; wrong password shows a generic error
- [ ] Google and Microsoft sign-in for an invited user → dashboard; the provider shows in Users & Roles
- [ ] Google sign-in for an unknown account → "No AuditOps access" (deny) or `/auth/pending` (pending)
- [ ] Verified domain auto-join gives the configured role
- [ ] Suspended user is signed out on the next navigation
- [ ] Invite email → set password → dashboard
- [ ] Forgot password → link → new password → all sessions signed out
- [ ] Contributor opening `/settings/users` → `/access-denied`; `/api/users` → 403
- [ ] Demoting the last Organization Admin is refused
