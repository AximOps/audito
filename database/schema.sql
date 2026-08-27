create extension if not exists pgcrypto;

create type public.activity_status as enum ('Not Started','In Progress','Pending Review','Completed','Overdue','Cancelled');
create type public.severity as enum ('Critical','High','Medium','Low','Informational');

create table public.organizations (id uuid primary key default gen_random_uuid(), name text not null, slug text unique not null, industry text, timezone text default 'Asia/Kolkata', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.user_profiles (id uuid primary key references auth.users(id) on delete cascade, organization_id uuid not null references public.organizations(id) on delete cascade, full_name text, job_title text, role text not null default 'Contributor', status text not null default 'Active', created_at timestamptz default now(), updated_at timestamptz default now());
create table public.assets (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, name text not null, asset_type text not null, hostname text, ip_address text, environment text, owner_id uuid references public.user_profiles(id), criticality text, status text default 'Active', description text, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.compliance_activities (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, title text not null, description text, category text not null, owner_id uuid references public.user_profiles(id), reviewer_id uuid references public.user_profiles(id), frequency text, status public.activity_status not null default 'Not Started', priority text default 'Medium', start_date date, due_date date, completed_at timestamptz, created_at timestamptz default now(), updated_at timestamptz default now());
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
