create extension if not exists pgcrypto;

create type public.activity_status as enum ('Not Started','In Progress','Pending Review','Completed','Overdue','Cancelled');
create type public.severity as enum ('Critical','High','Medium','Low','Informational');

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, industry text, timezone text default 'Asia/Kolkata', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.user_profiles (id uuid primary key references auth.users(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, full_name text, job_title text, role text not null default 'Contributor', status text not null default 'Active', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.assets (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, asset_type text not null, hostname text, ip_address text, environment text, owner_id uuid references public.user_profiles(id), criticality text, status text default 'Active', description text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.activity_categories (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint activity_categories_org_name_unique unique (organization_id,name));

create table public.activity_task_types (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, description text, is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint activity_task_types_org_name_unique unique (organization_id,name));

create table public.compliance_activities (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, description text, category text not null, category_id uuid references public.activity_categories(id) on delete set null, task_type text not null default 'Task', task_type_id uuid references public.activity_task_types(id) on delete set null, owner_id uuid references public.user_profiles(id), reviewer_id uuid references public.user_profiles(id), frequency text, status public.activity_status not null default 'Not Started', priority text default 'Medium', start_date date, due_date date, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.vulnerabilities (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, cve text, asset_id uuid references public.assets(id) on delete set null, application text, severity public.severity not null default 'Medium', status text not null default 'Open', discovered_date date, due_date date, owner_id uuid references public.user_profiles(id), description text, remediation text, exception_id uuid, resolved_date date, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.access_reviews (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, system_name text, review_period text, reviewer_id uuid references public.user_profiles(id), owner_id uuid references public.user_profiles(id), status text default 'Not Started', due_date date, completed_at timestamptz, created_at timestamptz default now());
create table public.access_review_items (id uuid primary key default gen_random_uuid(), access_review_id uuid not null references public.access_reviews(id) on delete cascade, user_name text not null, user_email text, role text, access_level text, decision text default 'Pending', reviewer_comment text, reviewed_at timestamptz);
create table public.policies (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, description text, version text default '1.0', status text default 'Draft', owner_id uuid references public.user_profiles(id), approved_by uuid references public.user_profiles(id), approved_at timestamptz, effective_date date, next_review_date date, document_path text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.evidence (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, activity_id uuid references public.compliance_activities(id) on delete cascade, name text not null, description text, file_path text, file_type text, file_size bigint, uploaded_by uuid references public.user_profiles(id), review_status text default 'Pending', reviewed_by uuid references public.user_profiles(id), reviewed_at timestamptz, expires_at date, created_at timestamptz default now());
create table public.findings (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, description text, source text, severity public.severity default 'Medium', status text default 'Open', owner_id uuid references public.user_profiles(id), due_date date, remediation text, resolved_date date, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.exceptions (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, description text, reason text, risk text, owner_id uuid references public.user_profiles(id), approved_by uuid references public.user_profiles(id), status text default 'Pending', start_date date, expiration_date date, mitigation text, created_at timestamptz default now(), updated_at timestamptz default now());
alter table public.vulnerabilities add constraint vulnerabilities_exception_fk foreign key (exception_id) references public.exceptions(id) on delete set null;
create table public.vendors (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, service text, owner_id uuid references public.user_profiles(id), risk_level text, status text default 'Active', last_review_date date, next_review_date date, soc_report_available boolean default false, notes text, created_at timestamptz default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, user_id uuid references public.user_profiles(id), action text not null, entity_type text, entity_id uuid, old_values jsonb, new_values jsonb, ip_address inet, created_at timestamptz default now());

create index idx_activities_org_due on public.compliance_activities(organization_id,due_date);
create index idx_vulns_org_status on public.vulnerabilities(organization_id,status);
create index idx_assets_org on public.assets(organization_id);

-- Helper: current user's organization.
create or replace function public.current_org_id() returns uuid language sql stable security definer set search_path=public as $$ select organization_id from public.user_profiles where id=auth.uid() $$;

-- Enable RLS.
alter table public.organizations enable row level security;
alter table public.user_profiles enable row level security;
alter table public.assets enable row level security;
alter table public.compliance_activities enable row level security;
alter table public.activity_categories enable row level security;
alter table public.activity_task_types enable row level security;
alter table public.vulnerabilities enable row level security;
alter table public.access_reviews enable row level security;
alter table public.access_review_items enable row level security;
alter table public.policies enable row level security;
alter table public.evidence enable row level security;
alter table public.findings enable row level security;
alter table public.exceptions enable row level security;
alter table public.vendors enable row level security;
alter table public.audit_logs enable row level security;

create policy org_select on public.organizations for select using (id=public.current_org_id());
create policy profile_same_org on public.user_profiles for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy assets_same_org on public.assets for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy activity_categories_select on public.activity_categories for select using (organization_id=public.current_org_id());
create policy activity_categories_insert on public.activity_categories for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));
create policy activity_categories_update on public.activity_categories for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager'])) with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));
create policy activity_categories_delete on public.activity_categories for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));
create policy activities_same_org on public.compliance_activities for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy vulns_same_org on public.vulnerabilities for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy reviews_same_org on public.access_reviews for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy review_items_same_org on public.access_review_items for all using (exists(select 1 from public.access_reviews r where r.id=access_review_id and r.organization_id=public.current_org_id())) with check (exists(select 1 from public.access_reviews r where r.id=access_review_id and r.organization_id=public.current_org_id()));
create policy policies_same_org on public.policies for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy evidence_same_org on public.evidence for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy findings_same_org on public.findings for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy exceptions_same_org on public.exceptions for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy vendors_same_org on public.vendors for all using (organization_id=public.current_org_id()) with check (organization_id=public.current_org_id());
create policy logs_same_org on public.audit_logs for select using (organization_id=public.current_org_id());

-- New-user profile trigger. Organization assignment can be completed by onboarding/admin flow.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin return new; end; $$;


-- Constrain role/status values used by the RBAC model.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check check (role in ('Organization Admin','Compliance Manager','Security Manager','IT Manager','Contributor','Auditor / Read Only'));
alter table public.user_profiles drop constraint if exists user_profiles_status_check;
alter table public.user_profiles add constraint user_profiles_status_check check (status in ('Active','Suspended'));

-- -----------------------------------------------------------------------------
-- AuditOps RBAC
-- The original organization-level policies are intentionally replaced below.
-- RLS remains the final authorization boundary; the UI only hides unavailable UI.
-- -----------------------------------------------------------------------------

create or replace function public.current_user_role() returns text
language sql stable security definer set search_path=public
as $$ select role from public.user_profiles where id=auth.uid() limit 1 $$;

create or replace function public.has_role(allowed_roles text[]) returns boolean
language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() = any(allowed_roles), false) $$;

-- Drop broad V1 policies before installing least-privilege policies.
drop policy if exists profile_same_org on public.user_profiles;
drop policy if exists assets_same_org on public.assets;
drop policy if exists activities_same_org on public.compliance_activities;
drop policy if exists vulns_same_org on public.vulnerabilities;
drop policy if exists reviews_same_org on public.access_reviews;
drop policy if exists review_items_same_org on public.access_review_items;
drop policy if exists policies_same_org on public.policies;
drop policy if exists evidence_same_org on public.evidence;
drop policy if exists findings_same_org on public.findings;
drop policy if exists exceptions_same_org on public.exceptions;
drop policy if exists vendors_same_org on public.vendors;
drop policy if exists logs_same_org on public.audit_logs;

-- Profiles: members can read their organization. Only admins can change roles/status.
create policy profile_select_same_org on public.user_profiles for select using (organization_id=public.current_org_id());
create policy profile_admin_insert on public.user_profiles for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));
create policy profile_admin_update on public.user_profiles for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin'])) with check (organization_id=public.current_org_id());
create policy profile_admin_delete on public.user_profiles for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));

-- Activities.
create policy activities_select on public.compliance_activities for select using (organization_id=public.current_org_id());
create policy activities_insert on public.compliance_activities for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor']));
create policy activities_update on public.compliance_activities for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy activities_delete on public.compliance_activities for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

-- Evidence.
create policy evidence_select on public.evidence for select using (organization_id=public.current_org_id());
create policy evidence_insert on public.evidence for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor']));
create policy evidence_update on public.evidence for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy evidence_delete on public.evidence for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

-- Policies.
create policy policies_select on public.policies for select using (organization_id=public.current_org_id());
create policy policies_insert on public.policies for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));
create policy policies_update on public.policies for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager'])) with check (organization_id=public.current_org_id());
create policy policies_delete on public.policies for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));

-- Security / IT modules.
create policy assets_select on public.assets for select using (organization_id=public.current_org_id());
create policy assets_insert on public.assets for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor']));
create policy assets_update on public.assets for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy assets_delete on public.assets for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager']));

create policy vulns_select on public.vulnerabilities for select using (organization_id=public.current_org_id());
create policy vulns_insert on public.vulnerabilities for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor']));
create policy vulns_update on public.vulnerabilities for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy vulns_delete on public.vulnerabilities for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager']));

create policy reviews_select on public.access_reviews for select using (organization_id=public.current_org_id());
create policy reviews_insert on public.access_reviews for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor']));
create policy reviews_update on public.access_reviews for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy reviews_delete on public.access_reviews for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Security Manager','IT Manager']));

create policy review_items_select on public.access_review_items for select using (exists(select 1 from public.access_reviews r where r.id=access_review_id and r.organization_id=public.current_org_id()));
create policy review_items_write on public.access_review_items for all using (exists(select 1 from public.access_reviews r where r.id=access_review_id and r.organization_id=public.current_org_id()) and public.has_role(array['Organization Admin','Security Manager','IT Manager','Contributor'])) with check (exists(select 1 from public.access_reviews r where r.id=access_review_id and r.organization_id=public.current_org_id()));

-- Risk.
create policy findings_select on public.findings for select using (organization_id=public.current_org_id());
create policy findings_insert on public.findings for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Security Manager','IT Manager','Contributor']));
create policy findings_update on public.findings for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Security Manager','IT Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy findings_delete on public.findings for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Security Manager']));

create policy exceptions_select on public.exceptions for select using (organization_id=public.current_org_id());
create policy exceptions_insert on public.exceptions for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Security Manager','IT Manager']));
create policy exceptions_update on public.exceptions for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Security Manager','IT Manager'])) with check (organization_id=public.current_org_id());
create policy exceptions_delete on public.exceptions for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

create policy vendors_select on public.vendors for select using (organization_id=public.current_org_id());
create policy vendors_insert on public.vendors for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));
create policy vendors_update on public.vendors for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager'])) with check (organization_id=public.current_org_id());
create policy vendors_delete on public.vendors for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));

-- Audit log is append-only from application/service code; users can only read.
create policy logs_select on public.audit_logs for select using (organization_id=public.current_org_id());


-- -----------------------------------------------------------------------------
-- AuditOps Multi-Organization foundation
-- -----------------------------------------------------------------------------

alter table public.organizations
  add column if not exists status text not null default 'Active';

alter table public.organizations
  add column if not exists plan text not null default 'Standard';

alter table public.organizations
  drop constraint if exists organizations_status_check;

alter table public.organizations
  add constraint organizations_status_check
  check (status in ('Active','Suspended','Pending'));

alter table public.user_profiles
  drop constraint if exists user_profiles_status_check;

alter table public.user_profiles
  add constraint user_profiles_status_check
  check (status in ('Active','Invited','Suspended'));

create table if not exists public.platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'Platform Admin',
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_users_role_check check (role in ('Platform Admin','Platform Support')),
  constraint platform_users_status_check check (status in ('Active','Suspended'))
);

create table if not exists public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'Contributor',
  status text not null default 'Active',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_role_check check (role in ('Organization Admin','Compliance Manager','Security Manager','IT Manager','Contributor','Auditor / Read Only')),
  constraint organization_memberships_status_check check (status in ('Active','Invited','Suspended')),
  constraint organization_memberships_org_user_unique unique (organization_id,user_id)
);

create index if not exists idx_org_memberships_user on public.organization_memberships(user_id,status);
create index if not exists idx_org_memberships_org on public.organization_memberships(organization_id,status);
create unique index if not exists uq_org_memberships_default on public.organization_memberships(user_id) where is_default = true;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists (
  select 1 from public.platform_users
  where user_id=auth.uid() and role='Platform Admin' and status='Active'
); $$;

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (
  select 1 from public.organization_memberships
  where user_id=auth.uid() and organization_id=target_org and status='Active'
); $$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path=public
as $$ select exists (
  select 1 from public.organization_memberships
  where user_id=auth.uid() and organization_id=target_org
    and role='Organization Admin' and status='Active'
); $$;

create or replace function public.current_org_id()
returns uuid language plpgsql stable security definer set search_path=public
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

  select up.organization_id into fallback_org
  from public.user_profiles up
  join public.organization_memberships om
    on om.user_id=up.id
   and om.organization_id=up.organization_id
   and om.status='Active'
  where up.id=auth.uid()
  limit 1;

  return fallback_org;
end;
$$;

create or replace function public.current_user_role()
returns text language sql stable security definer set search_path=public
as $$ select coalesce(
  (select role from public.organization_memberships
   where user_id=auth.uid()
     and organization_id=public.current_org_id()
     and status='Active' limit 1),
  (select role from public.user_profiles where id=auth.uid() limit 1)
); $$;

create or replace function public.has_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() = any(allowed_roles), false); $$;

alter table public.platform_users enable row level security;
alter table public.organization_memberships enable row level security;

drop policy if exists platform_users_select on public.platform_users;
drop policy if exists platform_users_insert on public.platform_users;
drop policy if exists platform_users_update on public.platform_users;
drop policy if exists platform_users_delete on public.platform_users;

create policy platform_users_select on public.platform_users for select to authenticated
using (user_id=auth.uid() or public.is_platform_admin());

create policy platform_users_insert on public.platform_users for insert to authenticated
with check (public.is_platform_admin());

create policy platform_users_update on public.platform_users for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy platform_users_delete on public.platform_users for delete to authenticated
using (public.is_platform_admin());

drop policy if exists organization_memberships_select on public.organization_memberships;
drop policy if exists organization_memberships_insert on public.organization_memberships;
drop policy if exists organization_memberships_update on public.organization_memberships;
drop policy if exists organization_memberships_delete on public.organization_memberships;

create policy organization_memberships_select on public.organization_memberships for select to authenticated
using (user_id=auth.uid() or public.is_platform_admin() or public.is_org_admin(organization_id));

create policy organization_memberships_insert on public.organization_memberships for insert to authenticated
with check (public.is_platform_admin() or public.is_org_admin(organization_id));

create policy organization_memberships_update on public.organization_memberships for update to authenticated
using (public.is_platform_admin() or public.is_org_admin(organization_id))
with check (public.is_platform_admin() or public.is_org_admin(organization_id));

create policy organization_memberships_delete on public.organization_memberships for delete to authenticated
using (public.is_platform_admin() or public.is_org_admin(organization_id));

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
using (public.is_platform_admin() or public.is_org_member(id));

drop policy if exists org_platform_insert on public.organizations;
drop policy if exists org_platform_update on public.organizations;
drop policy if exists org_platform_delete on public.organizations;

create policy org_platform_insert on public.organizations for insert to authenticated
with check (public.is_platform_admin());

create policy org_platform_update on public.organizations for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy org_platform_delete on public.organizations for delete to authenticated
using (public.is_platform_admin());
