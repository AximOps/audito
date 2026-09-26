# AuditOps MVP

AuditOps is a compliance operations platform for managing activities, evidence, vulnerabilities, assets, access reviews, policies and audit readiness.

## Stack
- Next.js + TypeScript
- Tailwind CSS
- Supabase PostgreSQL/Auth/Storage
- PostgreSQL Row Level Security (RLS)

## Authentication + RBAC
- `/login` uses Supabase email/password authentication.
- Protected application routes require an authenticated Supabase user.
- `/settings/users` is visible only to Organization Admins.
- RBAC is enforced in the UI, server API routes, and PostgreSQL RLS policies.
- Initial roles: Organization Admin, Compliance Manager, Security Manager, IT Manager, Contributor, Auditor / Read Only.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env.local`.
3. Add your Supabase URL and anon key.
4. For a fresh database, run `database/schema.sql` in Supabase SQL Editor. If you already installed the previous AuditOps MVP schema, run `database/migrations/001_rbac.sql` instead.
5. Create a user in Supabase Authentication.
6. Create an organization and matching `user_profiles` row for the user's auth UUID, with role `Organization Admin` for the first administrator.
7. `npm run dev`

## Current CRUD modules

- Compliance Activities: create, edit, delete, search, filter, owner/reviewer assignment, status, priority, frequency and due dates.
- User invitations: Organization Admins can invite users through `/settings/users`.
- Activity changes are written to `audit_logs`.

### Activity API

- `POST /api/activities` — create an activity.
- `PATCH /api/activities/:id` — update an activity.
- `DELETE /api/activities/:id` — delete an activity.
- These routes require an authenticated active AuditOps profile and enforce organization/role checks server-side.
- `SUPABASE_SERVICE_ROLE_KEY` is required on the server for activity writes and audit logging. Never expose it as a `NEXT_PUBLIC_*` variable.
