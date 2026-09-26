-- AuditOps Phase 3: Application-managed user directory
-- Option A: Supabase Auth remains the authentication engine.
-- The public.users table becomes the AuditOps application user directory.
-- Run after 005_multi_org_users_roles.sql.

-- 1. Application user directory.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  job_title text,
  status text not null default 'Invited',
  email_verified_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_unique unique (email),
  constraint users_status_check check (status in ('Active','Invited','Suspended','Disabled'))
);

create index if not exists idx_users_status on public.users(status);
create index if not exists idx_users_email_lower on public.users(lower(email));

-- 2. Backfill the directory from existing Auth users and legacy profiles.
insert into public.users (
  id,
  email,
  full_name,
  job_title,
  status,
  email_verified_at,
  last_login_at,
  created_at,
  updated_at
)
select
  au.id,
  lower(au.email),
  coalesce(nullif(trim(up.full_name), ''), nullif(trim(au.raw_user_meta_data->>'full_name'), '')),
  coalesce(nullif(trim(up.job_title), ''), nullif(trim(au.raw_user_meta_data->>'job_title'), '')),
  case
    when coalesce(up.status, 'Active') = 'Suspended' then 'Suspended'
    when coalesce(up.status, 'Active') = 'Invited' then 'Invited'
    else 'Active'
  end,
  au.email_confirmed_at,
  au.last_sign_in_at,
  coalesce(up.created_at, au.created_at),
  now()
from auth.users au
left join public.user_profiles up on up.id = au.id
where au.email is not null
on conflict (id) do update set
  email = excluded.email,
  full_name = coalesce(excluded.full_name, public.users.full_name),
  job_title = coalesce(excluded.job_title, public.users.job_title),
  email_verified_at = coalesce(excluded.email_verified_at, public.users.email_verified_at),
  last_login_at = coalesce(excluded.last_login_at, public.users.last_login_at),
  updated_at = now();

-- 3. Make the application directory the FK target for memberships.
alter table public.organization_memberships
  drop constraint if exists organization_memberships_user_id_user_profiles_fkey;

alter table public.organization_memberships
  drop constraint if exists organization_memberships_user_id_fkey;

alter table public.organization_memberships
  add constraint organization_memberships_user_id_users_fkey
  foreign key (user_id)
  references public.users(id)
  on delete cascade;

-- 4. Make the application directory the FK target for platform administrators.
alter table public.platform_users
  drop constraint if exists platform_users_user_id_fkey;

alter table public.platform_users
  add constraint platform_users_user_id_users_fkey
  foreign key (user_id)
  references public.users(id)
  on delete cascade;

-- 5. User-directory RLS.
alter table public.users enable row level security;

alter table public.users force row level security;

drop policy if exists users_select on public.users;
drop policy if exists users_insert on public.users;
drop policy if exists users_update on public.users;
drop policy if exists users_delete on public.users;

create policy users_select
on public.users for select
to authenticated
using (
  id = auth.uid()
  or public.is_platform_admin()
  or exists (
    select 1
    from public.organization_memberships om
    where om.user_id = public.users.id
      and om.organization_id = public.current_org_id()
      and om.status in ('Active','Invited','Suspended')
  )
);

-- Normal user creation is performed by the server-side portal APIs using
-- the Supabase service role. Browser clients cannot create directory users.
create policy users_insert
on public.users for insert
to authenticated
with check (public.is_platform_admin());

create policy users_update
on public.users for update
to authenticated
using (
  public.is_platform_admin()
  or id = auth.uid()
)
with check (
  public.is_platform_admin()
  or id = auth.uid()
);

-- Directory deletion is intentionally not exposed through the application.
-- Deactivation should be used instead so audit history remains intact.

-- 6. Helper for platform status checks now resolves through application users.
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
    join public.users u on u.id = pu.user_id
    where pu.user_id = auth.uid()
      and pu.role = 'Platform Admin'
      and pu.status = 'Active'
      and u.status = 'Active'
  );
$$;

-- Disabled application users must not retain tenant access even if an old
-- Supabase session remains active.
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
    join public.users u on u.id = om.user_id
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'Active'
      and u.status = 'Active'
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
    join public.users u on u.id = om.user_id
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.role = 'Organization Admin'
      and om.status = 'Active'
      and u.status = 'Active'
  );
$$;

-- 7. Keep current organization context fully membership-based.
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

  if header_value is not null
     and header_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    requested_org := header_value::uuid;

    if public.is_org_member(requested_org) then
      return requested_org;
    end if;
  end if;

  select om.organization_id
    into fallback_org
  from public.organization_memberships om
  join public.users u on u.id = om.user_id
  where om.user_id = auth.uid()
    and om.status = 'Active'
    and u.status = 'Active'
  order by om.is_default desc, om.created_at
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
  select om.role
  from public.organization_memberships om
  join public.users u on u.id = om.user_id
  where om.user_id = auth.uid()
    and om.organization_id = public.current_org_id()
    and om.status = 'Active'
    and u.status = 'Active'
  limit 1;
$$;

-- 8. Update profile trigger: user_profiles is retained as compatibility data,
-- but organization and role are no longer application sources of truth.
drop trigger if exists trg_prevent_user_profile_org_change on public.user_profiles;

-- Keep the old column immutable to prevent accidental tenant reassignment.
create trigger trg_prevent_user_profile_org_change
before update on public.user_profiles
for each row
execute function public.prevent_user_profile_org_change();

-- Platform administrators must also be able to review platform-level audit entries.
drop policy if exists logs_select on public.audit_logs;
create policy logs_select
on public.audit_logs for select
to authenticated
using (
  public.is_platform_admin()
  or organization_id = public.current_org_id()
);

-- 9. Platform-level user administration may not belong to an organization.
alter table public.audit_logs
  alter column organization_id drop not null;

-- 9. Directory-aware audit log helper is not needed; server routes write audit logs
-- with the service role after successful administrative operations.

notify pgrst, 'reload schema';
