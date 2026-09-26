-- AuditOps: organization-specific compliance activity categories
create table if not exists public.activity_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_categories_org_name_unique unique (organization_id, name)
);

alter table public.activity_categories enable row level security;

drop policy if exists activity_categories_select on public.activity_categories;
drop policy if exists activity_categories_insert on public.activity_categories;
drop policy if exists activity_categories_update on public.activity_categories;
drop policy if exists activity_categories_delete on public.activity_categories;

create policy activity_categories_select
on public.activity_categories
for select
to authenticated
using (organization_id = public.current_org_id());

create policy activity_categories_insert
on public.activity_categories
for insert
to authenticated
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['Organization Admin','Compliance Manager'])
);

create policy activity_categories_update
on public.activity_categories
for update
to authenticated
using (
  organization_id = public.current_org_id()
  and public.has_role(array['Organization Admin','Compliance Manager'])
)
with check (
  organization_id = public.current_org_id()
  and public.has_role(array['Organization Admin','Compliance Manager'])
);

create policy activity_categories_delete
on public.activity_categories
for delete
to authenticated
using (
  organization_id = public.current_org_id()
  and public.has_role(array['Organization Admin'])
);

alter table public.compliance_activities
add column if not exists category_id uuid references public.activity_categories(id) on delete set null;

create index if not exists idx_activity_categories_org
on public.activity_categories(organization_id, is_active, name);

create index if not exists idx_activities_category
on public.compliance_activities(category_id);

-- Seed the existing AuditOps Demo organization with useful starter categories.
insert into public.activity_categories (organization_id, name, description)
select
  o.id,
  v.name,
  v.description
from public.organizations o
cross join (values
  ('Access Management', 'User access, privileged access and access review activities.'),
  ('Asset Management', 'Asset inventory, ownership, classification and lifecycle activities.'),
  ('Vulnerability Management', 'Vulnerability scanning, remediation and exception activities.'),
  ('Risk Management', 'Risk identification, assessment, treatment and monitoring activities.'),
  ('Policy Management', 'Policy creation, review, approval and periodic review activities.'),
  ('Vendor Management', 'Third-party due diligence, reviews and vendor risk activities.'),
  ('Incident Management', 'Security incident response, investigation and follow-up activities.'),
  ('Change Management', 'Infrastructure, application and configuration change activities.'),
  ('Business Continuity', 'Business continuity planning, testing and maintenance activities.'),
  ('Disaster Recovery', 'Disaster recovery planning, testing and recovery readiness activities.'),
  ('Security Awareness', 'Security training, awareness and phishing simulation activities.'),
  ('Compliance Monitoring', 'Ongoing control monitoring and compliance verification activities.'),
  ('Audit Management', 'Internal and external audit preparation, execution and follow-up activities.'),
  ('Privacy', 'Privacy reviews, data protection and privacy compliance activities.'),
  ('Infrastructure Security', 'Cloud, network, endpoint and infrastructure security activities.')
) as v(name, description)
where o.slug = 'auditops-demo'
on conflict (organization_id, name) do nothing;

-- Link existing activities to categories where the old text value matches a category name.
update public.compliance_activities a
set category_id = c.id
from public.activity_categories c
where a.organization_id = c.organization_id
  and lower(trim(a.category)) = lower(trim(c.name))
  and a.category_id is null;
