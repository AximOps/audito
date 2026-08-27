-- Run this if you already installed the original AuditOps MVP schema.
-- It upgrades the broad organization-only policies to role-based policies.

alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check check (role in ('Organization Admin','Compliance Manager','Security Manager','IT Manager','Contributor','Auditor / Read Only'));
alter table public.user_profiles drop constraint if exists user_profiles_status_check;
alter table public.user_profiles add constraint user_profiles_status_check check (status in ('Active','Suspended'));

create or replace function public.current_user_role() returns text
language sql stable security definer set search_path=public
as $$ select role from public.user_profiles where id=auth.uid() limit 1 $$;

create or replace function public.has_role(allowed_roles text[]) returns boolean
language sql stable security definer set search_path=public
as $$ select coalesce(public.current_user_role() = any(allowed_roles), false) $$;

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

create policy profile_select_same_org on public.user_profiles for select using (organization_id=public.current_org_id());
create policy profile_admin_insert on public.user_profiles for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));
create policy profile_admin_update on public.user_profiles for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin'])) with check (organization_id=public.current_org_id());
create policy profile_admin_delete on public.user_profiles for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));

create policy activities_select on public.compliance_activities for select using (organization_id=public.current_org_id());
create policy activities_insert on public.compliance_activities for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor']));
create policy activities_update on public.compliance_activities for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy activities_delete on public.compliance_activities for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

create policy evidence_select on public.evidence for select using (organization_id=public.current_org_id());
create policy evidence_insert on public.evidence for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor']));
create policy evidence_update on public.evidence for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager','Contributor'])) with check (organization_id=public.current_org_id());
create policy evidence_delete on public.evidence for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));

create policy policies_select on public.policies for select using (organization_id=public.current_org_id());
create policy policies_insert on public.policies for insert with check (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager']));
create policy policies_update on public.policies for update using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin','Compliance Manager'])) with check (organization_id=public.current_org_id());
create policy policies_delete on public.policies for delete using (organization_id=public.current_org_id() and public.has_role(array['Organization Admin']));

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

create policy logs_select on public.audit_logs for select using (organization_id=public.current_org_id());
