begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', ''),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b@example.test', '');

insert into public.workspaces (id, name, slug, created_by)
values
  ('a0000000-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a', '10000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b', '20000000-0000-0000-0000-000000000002');

insert into public.workspace_members (workspace_id, user_id, role, status)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq(
  $$ select count(*)::bigint from public.workspaces $$,
  array[1::bigint],
  'an authenticated owner sees only their workspace'
);

insert into public.campaigns (
  id, workspace_id, external_id, name, objective, geography, target_segments,
  language
) values (
  'a1000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'tenant-a-campaign', 'Tenant A campaign', 'Find relevant partners', 'Italy',
  array['Distributor'], 'English'
);

select results_eq(
  $$ select count(*)::bigint from public.campaign_profile_snapshots where campaign_id = 'a1000000-0000-0000-0000-000000000001' $$,
  array[1::bigint],
  'campaign creation freezes one Company Profile snapshot'
);

select results_eq(
  $$ select count(*)::bigint from public.campaign_strategy_versions where campaign_id = 'a1000000-0000-0000-0000-000000000001' $$,
  array[1::bigint],
  'campaign creation creates one initial strategy version'
);

insert into public.leads (
  id, workspace_id, external_id, company, website, country, city, campaign_id,
  company_type, industry, estimated_size, description, fit_score, confidence,
  contactability, status, summary
) values (
  'a2000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'tenant-a-lead', 'Prospect A', 'https://prospect-a.example', 'Italy', 'Milan',
  'tenant-a-campaign', 'Distributor', 'Industrial', 'Unknown', 'Evidence-backed prospect',
  82, 'high', 'medium', 'approved', 'Relevant distributor'
);

insert into public.lead_contact_routes (
  id, lead_id, type, value, suggested_role, verification, source
) values (
  'a3000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001',
  'Email', 'sales@prospect-a.example', 'Sales', 'source_confirmed', 'https://prospect-a.example/contact'
);

insert into public.lead_outreach_states (
  workspace_id, lead_id, enrichment_status, selected_contact_route_id, selection_status
) values (
  'a0000000-0000-0000-0000-000000000001',
  'a2000000-0000-0000-0000-000000000001', 'contacts_ready',
  'a3000000-0000-0000-0000-000000000001', 'accepted'
);

insert into public.outreach_drafts (
  workspace_id, external_id, lead_external_id, campaign_external_id,
  recipient_route, subject, body, variant
) values (
  'a0000000-0000-0000-0000-000000000001', 'tenant-a-draft', 'tenant-a-lead',
  'tenant-a-campaign', 'sales@prospect-a.example', 'Relevant introduction',
  'Grounded draft body', 'primary'
);

insert into public.export_records (
  workspace_id, campaign_external_id, export_type, file_name, row_count, payload_json
) values (
  'a0000000-0000-0000-0000-000000000001', 'tenant-a-campaign',
  'outreach_csv', 'tenant-a.csv', 1, '[]'::jsonb
);

insert into public.usage_events (
  workspace_id, campaign_external_id, operation, estimated_credits, actual_credits
) values (
  'a0000000-0000-0000-0000-000000000001', 'tenant-a-campaign',
  'draft_generation', 2, 2
);

select results_eq(
  $$ select count(*)::bigint from public.leads where workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  array[1::bigint],
  'owner can read their campaign lead'
);

select results_eq(
  $$ select count(*)::bigint from public.lead_contact_routes $$,
  array[1::bigint],
  'owner can read their lead contact route'
);

select results_eq(
  $$ select count(*)::bigint from public.lead_outreach_states $$,
  array[1::bigint],
  'owner can read their accepted recipient state'
);

select results_eq(
  $$ select count(*)::bigint from public.outreach_drafts $$,
  array[1::bigint],
  'owner can read their persisted draft'
);

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$ select count(*)::bigint from public.campaigns where external_id = 'tenant-a-campaign' $$,
  array[0::bigint],
  'another tenant cannot read the campaign'
);

select results_eq(
  $$ select count(*)::bigint from public.leads where external_id = 'tenant-a-lead' $$,
  array[0::bigint],
  'another tenant cannot read the lead'
);

select results_eq(
  $$ select count(*)::bigint from public.outreach_drafts where external_id = 'tenant-a-draft' $$,
  array[0::bigint],
  'another tenant cannot read the draft'
);

select results_eq(
  $$ select (select count(*) from public.export_records) + (select count(*) from public.usage_events) $$,
  array[0::bigint],
  'another tenant cannot read export or usage history'
);

select throws_ok(
  $$ insert into public.export_records (workspace_id, campaign_external_id, export_type, file_name, row_count) values ('a0000000-0000-0000-0000-000000000001', 'tenant-a-campaign', 'outreach_csv', 'stolen.csv', 0) $$,
  '42501',
  null,
  'another tenant cannot write an export into the first workspace'
);

select throws_ok(
  $$ insert into public.usage_events (workspace_id, campaign_external_id, operation) values ('a0000000-0000-0000-0000-000000000001', 'tenant-a-campaign', 'export') $$,
  '42501',
  null,
  'another tenant cannot write usage into the first workspace'
);

select throws_ok(
  $$ select public.clear_workspace_data('a0000000-0000-0000-0000-000000000001') $$,
  '42501',
  null,
  'another tenant cannot clear the first workspace'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
select public.clear_workspace_data('a0000000-0000-0000-0000-000000000001');

select results_eq(
  $$
    select
      (select count(*) from public.campaigns) +
      (select count(*) from public.leads) +
      (select count(*) from public.outreach_drafts) +
      (select count(*) from public.research_runs) +
      (select count(*) from public.research_tasks) +
      (select count(*) from public.lead_sources) +
      (select count(*) from public.ai_generations) +
      (select count(*) from public.export_records) +
      (select count(*) from public.usage_events) +
      (select count(*) from public.activity_events)
  $$,
  array[0::bigint],
  'clearing removes all workspace workflow and history records'
);

select results_eq(
  $$
    select
      (select count(*) from public.workspaces)::bigint,
      (select count(*) from public.workspace_members)::bigint,
      (select count(*) from public.company_profiles)::bigint,
      (select count(*) from public.company_profile_versions)::bigint,
      (select min(version) from public.company_profile_versions)::bigint
  $$,
  $$ values (1::bigint, 1::bigint, 1::bigint, 1::bigint, 1::bigint) $$,
  'clearing preserves workspace access and recreates one baseline Company Profile'
);

select * from finish();
rollback;
