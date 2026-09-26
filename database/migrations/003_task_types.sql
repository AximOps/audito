-- AuditOps: organization-specific task types
create table if not exists public.activity_task_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_task_types_org_name_unique unique (organization_id, name)
);

alter table public.activity_task_types enable row level security;

drop policy if exists activity_task_types_select on public.activity_task_types;
drop policy if exists activity_task_types_insert on public.activity_task_types;
drop policy if exists activity_task_types_update on public.activity_task_types;
drop policy if exists activity_task_types_delete on public.activity_task_types;

create policy activity_task_types_select on public.activity_task_types
for select to authenticated using (organization_id = public.current_org_id());

create policy activity_task_types_insert on public.activity_task_types
for insert to authenticated
with check (organization_id = public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

create policy activity_task_types_update on public.activity_task_types
for update to authenticated
using (organization_id = public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']))
with check (organization_id = public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

create policy activity_task_types_delete on public.activity_task_types
for delete to authenticated
using (organization_id = public.current_org_id() and public.has_role(array['Organization Admin']));

alter table public.compliance_activities add column if not exists task_type text not null default 'Task';
alter table public.compliance_activities add column if not exists task_type_id uuid references public.activity_task_types(id) on delete set null;

create index if not exists idx_activity_task_types_org on public.activity_task_types(organization_id, is_active, name);
create index if not exists idx_activities_task_type on public.compliance_activities(task_type_id);

insert into public.activity_task_types (organization_id, name, description)
select o.id, v.name, v.description
from public.organizations o
cross join (values
  ('Task', 'General compliance task or action item.'),
  ('Change Request', 'A requested change to a system, process, configuration or control.'),
  ('Review', 'A formal review, assessment or validation activity.')
) as v(name, description)
where o.slug = 'auditops-demo'
on conflict (organization_id, name) do nothing;

update public.compliance_activities a
set task_type_id = t.id
from public.activity_task_types t
where a.organization_id = t.organization_id
  and lower(trim(coalesce(a.task_type, 'Task'))) = lower(trim(t.name))
  and a.task_type_id is null;
