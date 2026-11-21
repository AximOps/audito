# AuditOps

Compliance operations platform: tasks, evidence, policies, vulnerabilities, assets and access reviews, with
multi-organization role-based access control. Built on Next.js 14 and Supabase.

## Quick start

```bash
npm ci
cp .env.example .env.local   # fill in Supabase keys
npm run dev
```

Database: run `database/schema.sql`, then `database/migrations/002…009` in order.

## Sign-in & access

- Email/password, Google and Microsoft sign-in; Cloudflare Turnstile on every form
- Users are kept in the AuditOps directory. Access comes from an invitation or a verified company domain.
- Six organization roles plus Platform Admin. Enforced in middleware, API routes and Postgres RLS.

Setup: **[AUTH_SETUP.md](AUTH_SETUP.md)**. Review notes: **[REVIEW.md](REVIEW.md)**.
