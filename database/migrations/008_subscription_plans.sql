-- AuditOps Subscription Plan Catalog
-- Run after 007_organization_management.sql.
--
-- The organizations.subscription column stores the selected plan.
-- This table is the central entitlement catalog used by the application.

begin;

create table if not exists public.subscription_plans (
  code text primary key,
  name text not null,
  description text not null,
  max_users integer,
  max_frameworks integer,
  max_active_tasks integer,
  max_assets integer,
  max_vendors integer,
  max_policies integer,
  max_findings integer,
  max_vulnerabilities integer,
  evidence_gb integer,
  audit_log_days integer,
  features jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscription_plans_code_check
    check (code in ('FREE','Standard','Pro','Enterprise')),
  constraint subscription_plans_positive_limits_check
    check (
      (max_users is null or max_users > 0) and
      (max_frameworks is null or max_frameworks > 0) and
      (max_active_tasks is null or max_active_tasks > 0) and
      (max_assets is null or max_assets > 0) and
      (max_vendors is null or max_vendors > 0) and
      (max_policies is null or max_policies > 0) and
      (max_findings is null or max_findings > 0) and
      (max_vulnerabilities is null or max_vulnerabilities > 0) and
      (evidence_gb is null or evidence_gb > 0) and
      (audit_log_days is null or audit_log_days > 0)
    )
);

insert into public.subscription_plans (
  code, name, description,
  max_users, max_frameworks, max_active_tasks, max_assets,
  max_vendors, max_policies, max_findings, max_vulnerabilities,
  evidence_gb, audit_log_days, features
)
values
(
  'FREE', 'FREE', 'Explore AuditOps with a small compliance program.',
  3, 1, 25, 25, 10, 10, 25, 25, 1, 30,
  '{"recurringTasks":false,"automatedReminders":false,"advancedReporting":false,"crossFrameworkMapping":false,"customFields":false,"customRoles":false,"api":false,"webhooks":false,"ssoSaml":false,"scim":false,"ipRestrictions":false,"dataRetentionControls":false,"scheduledReports":false,"multiBusinessUnits":false,"prioritySupport":false,"dedicatedSupport":false}'::jsonb
),
(
  'Standard', 'Standard', 'Run an active compliance program for a small or medium organization.',
  10, 2, 250, 250, 50, 50, 250, 250, 10, 365,
  '{"recurringTasks":true,"automatedReminders":true,"advancedReporting":false,"crossFrameworkMapping":false,"customFields":false,"customRoles":false,"api":false,"webhooks":false,"ssoSaml":false,"scim":false,"ipRestrictions":false,"dataRetentionControls":false,"scheduledReports":false,"multiBusinessUnits":false,"prioritySupport":false,"dedicatedSupport":false}'::jsonb
),
(
  'Pro', 'Pro', 'Automate and scale a mature, multi-framework compliance program.',
  50, 5, 2500, 2500, 250, 250, 2500, 2500, 100, 1095,
  '{"recurringTasks":true,"automatedReminders":true,"advancedReporting":true,"crossFrameworkMapping":true,"customFields":true,"customRoles":true,"api":true,"webhooks":true,"ssoSaml":false,"scim":false,"ipRestrictions":false,"dataRetentionControls":true,"scheduledReports":true,"multiBusinessUnits":false,"prioritySupport":true,"dedicatedSupport":false}'::jsonb
),
(
  'Enterprise', 'Enterprise', 'Enterprise governance, security, integrations and scale.',
  null, null, null, null, null, null, null, null, null, null,
  '{"recurringTasks":true,"automatedReminders":true,"advancedReporting":true,"crossFrameworkMapping":true,"customFields":true,"customRoles":true,"api":true,"webhooks":true,"ssoSaml":true,"scim":true,"ipRestrictions":true,"dataRetentionControls":true,"scheduledReports":true,"multiBusinessUnits":true,"prioritySupport":true,"dedicatedSupport":true}'::jsonb
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  max_users = excluded.max_users,
  max_frameworks = excluded.max_frameworks,
  max_active_tasks = excluded.max_active_tasks,
  max_assets = excluded.max_assets,
  max_vendors = excluded.max_vendors,
  max_policies = excluded.max_policies,
  max_findings = excluded.max_findings,
  max_vulnerabilities = excluded.max_vulnerabilities,
  evidence_gb = excluded.evidence_gb,
  audit_log_days = excluded.audit_log_days,
  features = excluded.features,
  updated_at = now();

-- Ensure every existing organization points to a valid plan.
update public.organizations
set subscription = case
  when subscription in ('FREE','Standard','Pro','Enterprise') then subscription
  else 'FREE'
end;

alter table public.organizations
  drop constraint if exists organizations_subscription_plans_fk;

alter table public.organizations
  add constraint organizations_subscription_plans_fk
  foreign key (subscription)
  references public.subscription_plans(code)
  on update cascade
  on delete restrict;

create index if not exists idx_subscription_plans_active
  on public.subscription_plans(active);

commit;
