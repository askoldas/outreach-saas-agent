begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', ''),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a', '10000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b', '20000000-0000-0000-0000-000000000002');

insert into public.workspace_members (workspace_id, user_id, role)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner');

insert into public.company_profile_versions (
  id, workspace_id, company_profile_id, version, company_name, structured_profile, profile_status
)
select
  'a0100000-0000-0000-0000-000000000001', workspace_id, id, 1, 'Seller A',
  '{"offerings":[{"id":"offering-a","name":"Synthetic service"}]}'::jsonb, 'published'
from public.company_profiles where workspace_id = 'a0000000-0000-0000-0000-000000000001';

update public.company_profiles
set current_version_id = 'a0100000-0000-0000-0000-000000000001'
where workspace_id = 'a0000000-0000-0000-0000-000000000001';

insert into public.campaigns (
  id, workspace_id, external_id, name, objective, selected_offering_id, target_geography
) values (
  'a1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'tenant-a-campaign', 'Tenant A campaign', 'Find relevant partners', 'offering-a', 'Italy'
);

insert into public.campaign_profile_snapshots (
  id, workspace_id, campaign_id, company_profile_version_id, snapshot_data
) values (
  'a1100000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a0100000-0000-0000-0000-000000000001',
  '{"companyName":"Seller A","offering":"Synthetic service"}'::jsonb
);

insert into public.campaign_strategy_versions (
  id, workspace_id, campaign_id, version, status, strategy, prompt_version
) values (
  'a1200000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  1, 'ready', '{"criteria":["Public evidence"]}'::jsonb, 'fixture-v1'
);

update public.campaigns
set profile_snapshot_id = 'a1100000-0000-0000-0000-000000000001',
    current_strategy_version_id = 'a1200000-0000-0000-0000-000000000001'
where id = 'a1000000-0000-0000-0000-000000000001';

insert into public.campaign_runs (
  id, workspace_id, campaign_id, strategy_version_id, profile_snapshot_id, status, current_phase
) values (
  'a1300000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a1200000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000001',
  'qualifying', 'qualification'
);

insert into public.companies (
  id, workspace_id, name, normalized_name, website_url, country
) values (
  'a2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'Prospect A', 'prospect a', 'https://prospect-a.example', 'Italy'
);

insert into public.company_domains (
  workspace_id, company_id, domain, normalized_domain, is_primary
) values (
  'a0000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'prospect-a.example', 'prospect-a.example', true
);

insert into public.campaign_companies (
  id, workspace_id, campaign_id, campaign_run_id, company_id, status
) values (
  'a2100000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a1300000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001', 'approved'
);

insert into public.qualification_results (
  id, workspace_id, campaign_company_id, campaign_run_id, status, score, confidence,
  summary, schema_version, prompt_version, input_hash
) values (
  'a2200000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000001',
  'a1300000-0000-0000-0000-000000000001',
  'qualified', 82, 'high', 'Synthetic relevant company', '1', 'fixture-v1', 'fixture-input'
);

insert into public.contacts (
  id, workspace_id, company_id, contact_kind, full_name, job_title
) values (
  'a3000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'person', 'Alex Example', 'Partnerships Director'
);

insert into public.contact_methods (
  id, workspace_id, company_id, contact_id, method_type, value, normalized_value
) values (
  'a3100000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'email', 'alex@prospect-a.example', 'alex@prospect-a.example'
);

insert into public.campaign_contacts (
  id, workspace_id, campaign_company_id, contact_id, contact_method_id, selection_status
) values (
  'a3200000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000001',
  'a3000000-0000-0000-0000-000000000001',
  'a3100000-0000-0000-0000-000000000001',
  'selected'
);

insert into public.outreach_drafts (
  id, workspace_id, campaign_id, campaign_run_id, campaign_company_id,
  campaign_contact_id, profile_snapshot_id, strategy_version_id, subject, body,
  variant, input_hash
) values (
  'a4000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'a1000000-0000-0000-0000-000000000001',
  'a1300000-0000-0000-0000-000000000001',
  'a2100000-0000-0000-0000-000000000001',
  'a3200000-0000-0000-0000-000000000001',
  'a1100000-0000-0000-0000-000000000001',
  'a1200000-0000-0000-0000-000000000001',
  'Relevant introduction', 'Grounded synthetic draft', 'primary', 'draft-input'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[1::bigint],
  'owner sees only their workspace'
);
select results_eq(
  $$ select count(*)::bigint from public.campaign_runs $$,
  array[1::bigint],
  'owner reads their campaign run'
);
select results_eq(
  $$ select count(*)::bigint from public.campaign_companies $$,
  array[1::bigint],
  'owner reads their campaign company'
);
select results_eq(
  $$ select count(*)::bigint from public.qualification_results $$,
  array[1::bigint],
  'owner reads campaign qualification'
);
select results_eq(
  $$ select count(*)::bigint from public.contacts $$,
  array[1::bigint],
  'owner reads canonical contacts'
);
select results_eq(
  $$ select count(*)::bigint from public.outreach_drafts $$,
  array[1::bigint],
  'owner reads grounded drafts'
);
select results_eq(
  $$ select count(*)::bigint from public.ai_model_configs where workspace_id is null $$,
  array[9::bigint],
  'authenticated users can read global model routing'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$ select count(*)::bigint from public.campaigns where id = 'a1000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'another tenant cannot read the campaign'
);
select results_eq(
  $$ select count(*)::bigint from public.companies where id = 'a2000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'another tenant cannot read the company'
);
select results_eq(
  $$ select count(*)::bigint from public.contacts where id = 'a3000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'another tenant cannot read the contact'
);
select results_eq(
  $$ select count(*)::bigint from public.outreach_drafts where id = 'a4000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'another tenant cannot read the draft'
);
select throws_ok(
  $$ insert into public.companies (workspace_id, name, normalized_name) values ('a0000000-0000-0000-0000-000000000001', 'Stolen', 'stolen') $$,
  '42501',
  null,
  'another tenant cannot write a company into the first workspace'
);
select throws_ok(
  $$ insert into public.documents (workspace_id, storage_path, file_name, media_type, size_bytes) values ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001/stolen.pdf', 'stolen.pdf', 'application/pdf', 1) $$,
  '42501',
  null,
  'another tenant cannot write document metadata into the first workspace'
);
select throws_ok(
  $$ insert into public.campaign_companies (workspace_id, campaign_id, company_id) values ('b0000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001') $$,
  'P0001',
  'Cross-workspace campaign company',
  'cross-workspace campaign company association is rejected by an invariant'
);

select * from finish();
rollback;
