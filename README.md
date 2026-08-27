# AuditOps

AuditOps is a lightweight compliance operations platform MVP. V1 is framework-neutral and intentionally has **no external system integrations and no control mapping**.

## Stack
- Next.js + TypeScript
- Supabase PostgreSQL/Auth/Storage
- Tailwind CSS

## Run locally
1. Create a Supabase project.
2. Run `database/schema.sql` in Supabase SQL Editor.
3. Copy `.env.example` to `.env.local` and add your Supabase URL and anon key.
4. Run `npm install`.
5. Run `npm run dev`.

## Current MVP
- Dashboard
- Compliance Activities list
- Vulnerabilities list
- Assets, Evidence, Policies and Access Reviews scaffolding
- Multi-tenant database model + RLS

## Next implementation pass
- Supabase Auth login/signup/onboarding
- CRUD forms for every module
- Storage uploads for evidence/policies
- Role-aware permissions
- Audit log triggers
- Findings/Exceptions/Vendors screens
- Reports and recurring activity automation
