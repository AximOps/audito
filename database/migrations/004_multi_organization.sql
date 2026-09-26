-- AuditOps Multi-Organization / Multi-Tenant foundation
-- Safe, additive migration. It preserves the existing user_profiles.organization_id
-- column for backward compatibility while moving authorization to memberships.

-- 1. Organization lifecycle metadata
alter table public.organizations
  add column if not exists status text not null default 'Active';

alter table public.organizations
  add column if not exists plan text not null default 'Standard';

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('Active','Suspended','Pending'));


-- Invitation workflow compatibility: invited users are not active until
-- the Supabase invitation is accepted.
alter table public.user_profiles
  drop constraint if exists user_profiles_status_check;

alter table public.user_profiles
  add constraint user_profiles_status_check
  check (status in ('Active','Invited','Suspended'));

-- 2. Platform-level users
create table if not exists public.platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'Platform Admin',
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_users_role_check check (role in ('Platform Admin','Platform Support')),
  constraint platform_users_status_check check (status in ('Active','Suspended'))
);

-- 3. Organization memberships
create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Contributor',
  status text not null default 'Active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_role_check
    check (role in (
      'Organization Admin',
      'Compliance Manager',
      'Security Manager',
      'IT Manager',
      'Contributor',
      'Auditor / Read Only'
    )),
  constraint organization_memberships_status_check
    check (status in ('Active','Invited','Suspended')),
  constraint organization_memberships_org_user_unique
    unique (organization_id, user_id)
);

create index if not exists idx_org_memberships_user
  on public.organization_memberships(user_id, status);

create index if not exists idx_org_memberships_org
  on public.organization_memberships(organization_id, status);

create unique index if not exists uq_org_memberships_default
  on public.organization_memberships(user_id)
  where is_default = true;

-- 4. Backfill existing one-organization user profiles into memberships.
insert into public.organization_memberships
  (organization_id, user_id, role, status, is_default)
select
  up.organization_id,
  up.id,
  up.role,
  case
    when up.status = 'Suspended' then 'Suspended'
    when up.status = 'Invited' then 'Invited'
    else 'Active'
  end,
  true
from public.user_profiles up
where up.organization_id is not null
on conflict (organization_id, user_id)
do update set
  role = excluded.role,
  status = excluded.status,
  is_default = true,
  updated_at = now();

-- 5. Helper functions.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_users pu
    where pu.user_id = auth.uid()
      and pu.role = 'Platform Admin'
      and pu.status = 'Active'
  );
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'Active'
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.role = 'Organization Admin'
      and om.status = 'Active'
  );
$$;

-- 6. Current organization context.
-- The application supplies x-organization-id as a PostgREST request header.
-- The header is accepted only when the authenticated user has an active
-- membership in that organization. If absent, the legacy profile organization
-- is used as a safe backward-compatible default.
create or replace function public.current_org_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  header_value text;
  requested_org uuid;
  fallback_org uuid;
begin
  header_value := current_setting('request.headers', true)::json->>'x-organization-id';

  if header_value is not null and header_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    requested_org := header_value::uuid;

    if public.is_org_member(requested_org) then
      return requested_org;
    end if;
  end if;

  select up.organization_id
    into fallback_org
  from public.user_profiles up
  join public.organization_memberships om
    on om.user_id = up.id
   and om.organization_id = up.organization_id
   and om.status = 'Active'
  where up.id = auth.uid()
  limit 1;

  return fallback_org;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select om.role
      from public.organization_memberships om
      where om.user_id = auth.uid()
        and om.organization_id = public.current_org_id()
        and om.status = 'Active'
      limit 1
    ),
    (
      select up.role
      from public.user_profiles up
      where up.id = auth.uid()
      limit 1
    )
  );
$$;

create or replace function public.has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = any(allowed_roles), false);
$$;

-- 7. RLS for platform and organization administration.
alter table public.platform_users enable row level security;
alter table public.organization_memberships enable row level security;

drop policy if exists platform_users_select on public.platform_users;
drop policy if exists platform_users_insert on public.platform_users;
drop policy if exists platform_users_update on public.platform_users;
drop policy if exists platform_users_delete on public.platform_users;

create policy platform_users_select
on public.platform_users for select
to authenticated
using (user_id = auth.uid() or public.is_platform_admin());

create policy platform_users_insert
on public.platform_users for insert
to authenticated
with check (public.is_platform_admin());

create policy platform_users_update
on public.platform_users for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy platform_users_delete
on public.platform_users for delete
to authenticated
using (public.is_platform_admin());

drop policy if exists organization_memberships_select on public.organization_memberships;
drop policy if exists organization_memberships_insert on public.organization_memberships;
drop policy if exists organization_memberships_update on public.organization_memberships;
drop policy if exists organization_memberships_delete on public.organization_memberships;

create policy organization_memberships_select
on public.organization_memberships for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.is_org_admin(organization_id)
);

create policy organization_memberships_insert
on public.organization_memberships for insert
to authenticated
with check (
  public.is_platform_admin()
  or public.is_org_admin(organization_id)
);

create policy organization_memberships_update
on public.organization_memberships for update
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_admin(organization_id)
)
with check (
  public.is_platform_admin()
  or public.is_org_admin(organization_id)
);

create policy organization_memberships_delete
on public.organization_memberships for delete
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_admin(organization_id)
);

-- 8. Organization visibility.
drop policy if exists org_select on public.organizations;
create policy org_select
on public.organizations for select
to authenticated
using (
  public.is_platform_admin()
  or public.is_org_member(id)
);

drop policy if exists org_platform_insert on public.organizations;
drop policy if exists org_platform_update on public.organizations;
drop policy if exists org_platform_delete on public.organizations;

create policy org_platform_insert
on public.organizations for insert
to authenticated
with check (public.is_platform_admin());

create policy org_platform_update
on public.organizations for update
to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy org_platform_delete
on public.organizations for delete
to authenticated
using (public.is_platform_admin());

-- 9. Preserve the current AuditOps Demo as the default tenant.
-- Existing membership backfill already handles the current admin.
update public.organization_memberships om
set is_default = true,
    status = 'Active',
    updated_at = now()
where om.organization_id = (
  select id from public.organizations where slug = 'auditops-demo' limit 1
)
and om.user_id = (
  select up.id from public.user_profiles up
  where up.organization_id = om.organization_id
  order by up.created_at
  limit 1
);

-- 10. Optional platform bootstrap.
-- DO NOT automatically make every existing user a Platform Admin.
-- After reviewing the migration, explicitly insert the desired platform
-- administrator(s), for example:
--
-- insert into public.platform_users (user_id, role)
-- select id, 'Platform Admin'
-- from auth.users
-- where email = 'your-platform-admin@example.com'
-- on conflict (user_id) do update set role='Platform Admin', status='Active';
