# Installation

1. Copy these files into the existing AuditOps project.
2. Run `database/migrations/007_organization_management.sql` in Supabase SQL Editor.
3. Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured on the server/Vercel project.
4. Deploy.

The existing Platform navigation already points Platform Admin users to `/platform/organizations` in the Phase 3 application shell.

The organization page is Platform Admin-only through the server API. The browser does not receive the service role key.
