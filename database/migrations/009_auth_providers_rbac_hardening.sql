-- AuditOps 009: Social / password sign-in, domain auto-join, RBAC hardening
-- Run after 008_subscription_plans.sql.
--
-- Adds:
--   1. 'Pending' directory status (self-registered users awaiting approval)
--   2. Sign-in provider tracking on public.users
--   3. Verified organization email domains (single owner per domain) used for
--      Google / Microsoft / password auto-join with a default role
--   4. Column guard so a signed-in user cannot change their own status,
--      email or login metadata through the browser (privilege escalation fix:
--      policy users_update allowed id = auth.uid() to update ANY column,
--      including status 'Suspended' -> 'Active')
--   5. audit_logs.user_id now references public.users (was user_profiles, which
--      made audit inserts fail for directory users without a legacy profile)
--   6. get_access_context(): one call used by middleware for route-level RBAC

begin;

-- 1. Directory status ---------------------------------------------------------
alter table public.users drop constraint if exists users_status_check;
alter table public.users
  add constraint users_status_check
  check (status in ('Active','Invited','Pending','Suspended','Disabled'));

-- 2. Sign-in provider tracking -----------------------------------------------
alter table public.users add column if not exists auth_providers text[] not null default '{}';
alter table public.users add column if not exists last_login_provider text;
alter table public.users add column if not exists approved_at timestamptz;
alter table public.users add column if not exists approved_by uuid references public.users(id) on delete set null;

-- 3. Verified organization email domains --------------------------------------
-- The domain is the primary key, so one domain can belong to one organization
-- only. Only Platform Admins manage this table (via the service-role API);
-- otherwise any Organization Admin could claim e.g. "gmail.com" and capture
-- every new sign-in from that domain.
create table if not exists public.organization_email_domains (
  domain text primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  auto_join boolean not null default true,
  auto_join_role text not null default 'Contributor',
  allowed_providers text[] not null default array['google','azure','email'],
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_email_domains_domain_format
    check (domain = lower(domain) and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  constraint organization_email_domains_role_check
    check (auto_join_role in (
      'Organization Admin','Compliance Manager','Security Manager',
      'IT Manager','Contributor','Auditor / Read Only'
    )),
  constraint organization_email_domains_providers_check
    check (allowed_providers <@ array['google','azure','email'])
);

create index if not exists idx_org_email_domains_org
  on public.organization_email_domains(organization_id);

alter table public.organization_email_domains enable row level security;

drop policy if exists org_email_domains_select on public.organization_email_domains;
create policy org_email_domains_select
on public.organization_email_domains for select
to authenticated
using (public.is_platform_admin() or public.is_org_admin(organization_id));
-- No insert/update/delete policies: writes go through the platform API
-- using the service role.

-- 4. Directory column guard ----------------------------------------------------
-- SECURITY INVOKER on purpose: current_user must be the caller's role
-- ('authenticated' for browser requests), not the function owner.
create or replace function public.protect_user_directory_columns()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Service role / SQL editor / migrations are trusted.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.is_platform_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.status is distinct from old.status
     or new.email_verified_at is distinct from old.email_verified_at
     or new.last_login_at is distinct from old.last_login_at
     or new.auth_providers is distinct from old.auth_providers
     or new.last_login_provider is distinct from old.last_login_provider
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Only full_name and job_title can be changed on your own directory record'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_user_directory_columns on public.users;
create trigger trg_protect_user_directory_columns
before update on public.users
for each row execute function public.protect_user_directory_columns();

-- Memberships: an Organization Admin must not be able to remove the last
-- active Organization Admin of an organization (lock-out protection).
create or replace function public.protect_last_org_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
  target_org uuid;
begin
  target_org := coalesce(old.organization_id, new.organization_id);

  if old.role = 'Organization Admin' and old.status = 'Active' and (
       tg_op = 'DELETE'
       or new.role <> 'Organization Admin'
       or new.status <> 'Active'
     ) then
    select count(*) into remaining
    from public.organization_memberships
    where organization_id = target_org
      and role = 'Organization Admin'
      and status = 'Active'
      and id <> old.id;

    if remaining = 0 and exists (
      select 1 from public.organizations o
      where o.id = target_org and o.status <> 'Removed'
    ) then
      raise exception 'An organization must keep at least one active Organization Admin'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_last_org_admin on public.organization_memberships;
create trigger trg_protect_last_org_admin
before update or delete on public.organization_memberships
for each row execute function public.protect_last_org_admin();

-- 5. Audit log FK -------------------------------------------------------------
alter table public.audit_logs drop constraint if exists audit_logs_user_id_fkey;
alter table public.audit_logs drop constraint if exists audit_logs_user_id_users_fkey;

-- Null out references that do not exist in the directory before re-pointing.
update public.audit_logs al
set user_id = null
where user_id is not null
  and not exists (select 1 from public.users u where u.id = al.user_id);

alter table public.audit_logs
  add constraint audit_logs_user_id_users_fkey
  foreign key (user_id) references public.users(id) on delete set null;

create index if not exists idx_audit_logs_org_created
  on public.audit_logs(organization_id, created_at desc);
create index if not exists idx_audit_logs_action
  on public.audit_logs(action, created_at desc);

-- 6. Access context for middleware --------------------------------------------
create or replace function public.get_access_context(requested_org uuid default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_user_status text;
  v_platform_role text;
  v_org uuid;
  v_role text;
begin
  if uid is null then
    return json_build_object('authenticated', false);
  end if;

  select u.status into v_user_status from public.users u where u.id = uid;

  select pu.role into v_platform_role
  from public.platform_users pu
  where pu.user_id = uid and pu.status = 'Active';

  if requested_org is not null and public.is_org_member(requested_org) then
    v_org := requested_org;
  else
    select om.organization_id into v_org
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = uid and om.status = 'Active' and o.status = 'Active'
    order by om.is_default desc, om.created_at
    limit 1;
  end if;

  if v_org is not null then
    select om.role into v_role
    from public.organization_memberships om
    where om.user_id = uid and om.organization_id = v_org and om.status = 'Active';
  end if;

  return json_build_object(
    'authenticated', true,
    'user_status', v_user_status,
    'platform_role', case when v_user_status = 'Active' then v_platform_role end,
    'organization_id', case when v_user_status = 'Active' then v_org end,
    'role', case when v_user_status = 'Active' then v_role end
  );
end;
$$;

revoke execute on function public.get_access_context(uuid) from public;
grant execute on function public.get_access_context(uuid) to authenticated;

commit;

notify pgrst, 'reload schema';
