-- AuditOps Multi-Organization Phase 2
-- Membership-aware Users & Roles foundation.
-- Run after 004_multi_organization.sql.

-- 1. Link memberships to the application profile.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_memberships_user_id_user_profiles_fkey'
  ) then
    alter table public.organization_memberships
      add constraint organization_memberships_user_id_user_profiles_fkey
      foreign key (user_id)
      references public.user_profiles(id)
      on delete cascade;
  end if;
end $$;

-- 2. Keep the legacy user_profiles.organization_id column for compatibility,
-- but prevent it from being used to move a user between organizations.
create or replace function public.prevent_user_profile_org_change()
returns trigger
language plpgsql
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'user_profiles.organization_id is managed by organization_memberships and cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_user_profile_org_change on public.user_profiles;

create trigger trg_prevent_user_profile_org_change
before update on public.user_profiles
for each row
execute function public.prevent_user_profile_org_change();

-- 3. user_profiles is now profile data, not the source of organization access
-- or organization role.
drop policy if exists profile_select_same_org on public.user_profiles;
drop policy if exists profile_admin_insert on public.user_profiles;
drop policy if exists profile_admin_update on public.user_profiles;
drop policy if exists profile_admin_delete on public.user_profiles;

create policy profile_select_same_org
on public.user_profiles
for select
to authenticated
using (
  public.is_platform_admin()
  or exists (
    select 1
    from public.organization_memberships om
    where om.user_id = public.user_profiles.id
      and om.organization_id = public.current_org_id()
      and om.status = 'Active'
  )
);

create policy profile_admin_insert
on public.user_profiles
for insert
to authenticated
with check (
  public.is_platform_admin()
  or (
    organization_id = public.current_org_id()
    and public.is_org_admin(public.current_org_id())
  )
);

-- NOTE:
-- PostgreSQL RLS WITH CHECK cannot reference OLD directly.
-- Replace the UPDATE policy above with an UPDATE policy that does not
-- attempt to use OLD; the trigger above protects organization_id immutability.
drop policy if exists profile_admin_update on public.user_profiles;

create policy profile_admin_update
on public.user_profiles
for update
to authenticated
using (
  public.is_platform_admin()
  or (
    public.is_org_admin(public.current_org_id())
    and exists (
      select 1
      from public.organization_memberships om
      where om.user_id = public.user_profiles.id
        and om.organization_id = public.current_org_id()
        and om.status = 'Active'
    )
  )
)
with check (
  public.is_platform_admin()
  or (
    public.is_org_admin(public.current_org_id())
    and exists (
      select 1
      from public.organization_memberships om
      where om.user_id = public.user_profiles.id
        and om.organization_id = public.current_org_id()
        and om.status = 'Active'
    )
  )
);

-- 4. Secure server-side helper for adding an existing Auth user to an organization.
-- This avoids exposing auth.users to the browser. It accepts an email and resolves
-- the Auth user inside a SECURITY DEFINER function.
create or replace function public.add_organization_member_by_email(
  target_org uuid,
  target_email text,
  target_role text default 'Contributor',
  target_status text default 'Active'
)
returns public.organization_memberships
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  membership public.organization_memberships;
begin
  if not (public.is_platform_admin() or public.is_org_admin(target_org)) then
    raise exception 'Only a Platform Admin or Organization Admin can add organization members';
  end if;

  if not exists (
    select 1
    from public.organizations o
    where o.id = target_org
      and o.status = 'Active'
  ) then
    raise exception 'Organization does not exist or is not active';
  end if;

  if target_role not in (
    'Organization Admin',
    'Compliance Manager',
    'Security Manager',
    'IT Manager',
    'Contributor',
    'Auditor / Read Only'
  ) then
    raise exception 'Invalid organization role';
  end if;

  if target_status not in ('Active','Invited','Suspended') then
    raise exception 'Invalid membership status';
  end if;

  select u.id
    into target_user_id
  from auth.users u
  where lower(u.email) = lower(trim(target_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No AuditOps login was found for this email address';
  end if;

  -- Keep one global profile row per Auth user. If a legacy profile does not
  -- exist yet, create it for the target organization.
  insert into public.user_profiles (
    id,
    organization_id,
    full_name,
    role,
    status
  )
  values (
    target_user_id,
    target_org,
    coalesce(
      nullif(trim(coalesce((select raw_user_meta_data->>'full_name'
                           from auth.users where id = target_user_id), '')), ''),
      split_part(trim(target_email), '@', 1)
    ),
    target_role,
    case when target_status = 'Invited' then 'Invited' else target_status end
  )
  on conflict (id) do nothing;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status,
    is_default
  )
  values (
    target_org,
    target_user_id,
    target_role,
    target_status,
    not exists (
      select 1
      from public.organization_memberships
      where user_id = target_user_id
        and is_default = true
    )
  )
  on conflict (organization_id, user_id)
  do update set
    role = excluded.role,
    status = excluded.status,
    updated_at = now()
  returning * into membership;

  return membership;
end;
$$;

grant execute on function public.add_organization_member_by_email(uuid,text,text,text)
to authenticated;


-- 5. Read organization members, including Auth email, without exposing auth.users
-- directly to the browser.
create or replace function public.get_organization_members(target_org uuid)
returns table (
  user_id uuid,
  email text,
  full_name text,
  job_title text,
  role text,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not (public.is_platform_admin() or public.is_org_admin(target_org)) then
    raise exception 'Only a Platform Admin or Organization Admin can view organization members';
  end if;

  return query
  select
    om.user_id,
    au.email::text,
    up.full_name,
    up.job_title,
    om.role,
    om.status,
    om.created_at
  from public.organization_memberships om
  join auth.users au on au.id = om.user_id
  left join public.user_profiles up on up.id = om.user_id
  where om.organization_id = target_org
  order by om.created_at;
end;
$$;

grant execute on function public.get_organization_members(uuid) to authenticated;

revoke execute on function public.get_organization_members(uuid) from public;
revoke execute on function public.add_organization_member_by_email(uuid,text,text,text) from public;

-- 6. Make membership role/status authoritative for the Users & Roles screen.
-- The existing current_user_role() from migration 004 already resolves the
-- active membership role for the selected organization.

notify pgrst, 'reload schema';
