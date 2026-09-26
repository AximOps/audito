-- AuditOps Organization Management / Subscription
-- Run after 006_application_user_directory.sql.
--
-- Adds:
--   - subscription: FREE | Standard | Pro | Enterprise
--   - Removed organization lifecycle state
--   - soft-removal timestamp
--   - updated_at maintenance
--   - active-organization enforcement in membership helpers
--
-- The existing organizations.plan column is retained for backward
-- compatibility with earlier AuditOps code. It is synchronized with
-- subscription by the trigger below.

begin;

-- 1. Subscription
alter table public.organizations
  add column if not exists subscription text not null default 'FREE';

-- Existing organizations previously used plan. Preserve those values where
-- they map to the new subscription model; anything else becomes FREE.
update public.organizations
set subscription = case
  when lower(coalesce(plan, '')) = 'free' then 'FREE'
  when lower(coalesce(plan, '')) = 'standard' then 'Standard'
  when lower(coalesce(plan, '')) = 'pro' then 'Pro'
  when lower(coalesce(plan, '')) = 'enterprise' then 'Enterprise'
  else 'FREE'
end
where subscription = 'FREE';

alter table public.organizations
  drop constraint if exists organizations_subscription_check;

alter table public.organizations
  add constraint organizations_subscription_check
  check (subscription in ('FREE','Standard','Pro','Enterprise'));

-- 2. Organization lifecycle
alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('Active','Suspended','Pending','Removed'));

-- 3. Soft removal and timestamps
alter table public.organizations
  add column if not exists removed_at timestamptz;

alter table public.organizations
  add column if not exists updated_at timestamptz not null default now();

-- Existing plan is kept in sync for backward compatibility.
update public.organizations
set plan = subscription
where plan is distinct from subscription;

create or replace function public.sync_organization_subscription()
returns trigger
language plpgsql
as $$
begin
  if new.subscription is distinct from old.subscription then
    new.plan := new.subscription;
  elsif new.plan is distinct from old.plan then
    new.subscription := case
      when lower(coalesce(new.plan, '')) = 'free' then 'FREE'
      when lower(coalesce(new.plan, '')) = 'standard' then 'Standard'
      when lower(coalesce(new.plan, '')) = 'pro' then 'Pro'
      when lower(coalesce(new.plan, '')) = 'enterprise' then 'Enterprise'
      else new.subscription
    end;
  end if;

  new.updated_at := now();

  if new.status = 'Removed' and old.status is distinct from 'Removed' then
    new.removed_at := now();
  elsif new.status <> 'Removed' then
    new.removed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists organizations_sync_subscription
on public.organizations;

create trigger organizations_sync_subscription
before update on public.organizations
for each row
execute function public.sync_organization_subscription();

create index if not exists idx_organizations_status
  on public.organizations(status);

create index if not exists idx_organizations_subscription
  on public.organizations(subscription);

-- 4. Only active organizations can be selected as an active membership.
-- This prevents a Suspended/Removed organization from remaining accessible
-- through an old membership or organization context header.
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
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.status = 'Active'
      and u.status = 'Active'
      and o.status = 'Active'
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
    join public.organizations o on o.id = om.organization_id
    where om.user_id = auth.uid()
      and om.organization_id = target_org
      and om.role = 'Organization Admin'
      and om.status = 'Active'
      and u.status = 'Active'
      and o.status = 'Active'
  );
$$;

commit;
