# AuditOps Review — Auth & RBAC (2026-11-21)

## Fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | Critical | RLS policy `users_update` let any signed-in user update their **own** row, every column included. A suspended user could set `status='Active'` and get tenant access back. | Trigger `protect_user_directory_columns` (009). Users can only change `full_name` and `job_title`. Verified against Postgres. |
| 2 | High | `/auth/callback` was not a public route. Middleware sent unauthenticated callback requests to `/login`, so invitation links and every OAuth or PKCE flow failed. | New middleware public list: `/auth/callback`, `/auth/confirm`, `/auth/complete`, `/api/auth/*`. |
| 3 | High | Invitation links (implicit flow, tokens in the `#fragment`) reached a server route that requires `?code` and always ended in `missing_code`. Invited users never set a password. | The callback forwards fragment links to `/auth/complete`. `/auth/confirm` added for `token_hash`. Invitations now go to "Set your password". |
| 4 | High | The callback set `status: "Active"` for any user who was not `Disabled`. A **Suspended** user could reactivate themselves by signing in again. | `finalizeSignIn` refuses both Suspended and Disabled users. |
| 5 | High | The callback created a directory record for **any** authenticated account. With OAuth turned on, any Google user would get one. | Provisioning policy: invitation, verified domain, or `AUTH_UNKNOWN_USER_POLICY` (deny or pending). |
| 6 | High | `audit_logs.user_id` referenced `user_profiles`. Audit inserts for directory-only users failed without notice. | FK repointed to `public.users` (009). |
| 7 | Medium | `schema.sql` failed on a fresh database (`has_role` was used before it was defined). | Helpers moved above their first use. Full chain schema → 002–009 tested on Postgres 16. |
| 8 | Medium | UI treated Platform Admins as Organization Admins in every organization, but RLS uses the membership role. Buttons showed up and then failed. Several APIs had a "Platform Admin bypass" that RLS rejected anyway. | One effective role (the membership role) across UI and API. Platform functions stay under `/platform`. |
| 9 | Medium | Contributors passed the API check for asset **delete** (it checked write roles), but RLS refused the delete. | Central matrix with action-level `delete`. |
| 10 | Medium | `GET /api/users` for a Platform Admin with no organization listed **every tenant's** memberships, then crashed on `organizationId!`. | Now requires an organization context. |
| 11 | Medium | A Platform Admin changing a role on Users & Roles got "success", but nothing was saved. | The PATCH applies membership changes after directory changes. |
| 12 | Medium | Editing your own name or title failed ("cannot change your own role"), because the modal always sent `role`. | The API compares against the current values. |
| 13 | Medium | Nothing stopped the last Organization Admin from being demoted or removed (lock-out). | Trigger `protect_last_org_admin` with a readable error. |
| 14 | Medium | Page gating was client-side only. Protected pages rendered, then hid content. | Middleware RBAC via `get_access_context()`. It also blocks Suspended, Pending and orphan sessions on every request. |
| 15 | Low | The active organization was split between localStorage (browser) and an httpOnly cookie (server), so they could disagree. | One readable cookie as the source of truth. Membership is still validated in the database. |
| 16 | Low | Password reset accepted 8-character passwords and did not end other sessions. | 10+ characters, three character classes. Recovery signs out every session. |
| 17 | Low | No security headers. | CSP (Turnstile-aware), XFO, nosniff, Referrer-Policy, HSTS, Permissions-Policy. |
| 18 | Low | Sign-in, sign-out and denied sign-ins were not audited. | `AUTH_SIGN_IN`, `AUTH_SIGN_IN_DENIED`, `AUTH_SIGN_OUT`, `USER_AUTO_JOINED_BY_DOMAIN`, `USER_MEMBERSHIP_UPDATED`. |
| 19 | Low | The `?next=` redirect was not validated. | `safeNextPath` allows only same-site paths (tested against `//evil.com` and `/\evil`). |

## Added

- Sign-in with email/password, Google and Microsoft; optional self sign-up. Each method is controlled by an env flag.
- Cloudflare Turnstile on sign-in, sign-up, forgot password and OAuth start. It can be verified by the app or by Supabase.
- Server-side auth routes: `/api/auth/{login,oauth,signup,forgot-password,finalize,signout}`.
- Verified email domains with auto-join role and allowed providers (Platform → Email Domains).
- **Sign-in & Access** page for Organization Admins: enabled methods, domain settings, role permission matrix.
- Users & Roles: sign-in methods, last sign-in, role descriptions, remove-from-organization with confirmation.
- `/auth/pending` and `/access-denied` screens.

## Recommended next steps (not done)

1. **Turn on `TURNSTILE_MODE=supabase`** so CAPTCHA also covers direct Auth API calls.
2. **MFA (TOTP)** for Organization and Platform Admins. Supabase supports it; enforce `aal2` in `get_access_context`.
3. **Resend invitation** action. A second `inviteUserByEmail` for an existing user fails; use `generateLink`.
4. Repository hygiene: `auditops.zip`, `generate.py` and the patch notes (`*_INTEGRATION.md`, `docs/*FIX*`) are leftover
   artifacts. `generate.py` writes an old scaffold with `"latest"` dependency versions. Remove them and replace the
   README.
5. `user_profiles` is still the FK target for owner and reviewer columns. Migrating those to `public.users` would retire
   the compatibility table.
6. Evidence, Policies and Access Reviews are still placeholders.
7. Rate limiting is left to Supabase Auth limits plus Turnstile. Add an edge rate limit (Vercel/Upstash) if needed.
