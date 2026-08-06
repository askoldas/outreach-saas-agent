-- WP-01: persist Intelligence V1/V2 rollout decisions without enabling V2 behavior.

alter table public.company_profile_versions
  add column intelligence_version text not null default 'v1'
    check (intelligence_version in ('v1', 'v2'));

alter table public.campaigns
  add column intelligence_version text not null default 'v1'
    check (intelligence_version in ('v1', 'v2')),
  add column workflow_version text not null default 'v1'
    check (workflow_version in ('v1', 'v2'));

alter table public.campaign_runs
  add column workflow_version text not null default 'v1'
    check (workflow_version in ('v1', 'v2')),
  add column contract_versions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(contract_versions) = 'object');

create table public.workspace_intelligence_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  profile_version text not null default 'v1'
    check (profile_version in ('v1', 'v2')),
  campaign_workflow text not null default 'v1'
    check (campaign_workflow in ('v1', 'v2')),
  shadow_mode boolean not null default false,
  enabled_providers text[] not null default array['web']::text[]
    check (cardinality(enabled_providers) > 0),
  result_write_mode text not null default 'none'
    check (result_write_mode in ('none', 'shadow', 'canonical')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.workspace_intelligence_settings (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

create or replace function public.ensure_workspace_intelligence_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_intelligence_settings (workspace_id)
  values (new.id)
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

create trigger workspaces_ensure_intelligence_settings
after insert on public.workspaces
for each row execute function public.ensure_workspace_intelligence_settings();

create trigger workspace_intelligence_settings_set_updated_at
before update on public.workspace_intelligence_settings
for each row execute function public.set_updated_at();

alter table public.workspace_intelligence_settings enable row level security;

create policy "Members can read workspace intelligence settings"
on public.workspace_intelligence_settings
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Admins can update workspace intelligence settings"
on public.workspace_intelligence_settings
for update to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create index company_profile_versions_intelligence_version_idx
  on public.company_profile_versions(workspace_id, intelligence_version, version desc);

create index campaigns_workflow_version_idx
  on public.campaigns(workspace_id, workflow_version, created_at desc);

create index campaign_runs_workflow_version_idx
  on public.campaign_runs(workspace_id, workflow_version, created_at desc);

create or replace function public.prevent_frozen_intelligence_version_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'campaign_runs'
    and (
      new.workflow_version is distinct from old.workflow_version
      or new.contract_versions is distinct from old.contract_versions
    )
  then
    raise exception 'Campaign Run workflow and contract versions are immutable'
      using errcode = '23514';
  end if;

  if tg_table_name = 'campaigns'
    and (
      new.workflow_version is distinct from old.workflow_version
      or new.intelligence_version is distinct from old.intelligence_version
    )
    and exists (
      select 1 from public.campaign_runs
      where campaign_id = old.id
    )
  then
    raise exception 'Campaign intelligence and workflow versions are frozen after the first run'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger campaign_runs_freeze_intelligence_versions
before update of workflow_version, contract_versions on public.campaign_runs
for each row execute function public.prevent_frozen_intelligence_version_change();

create trigger campaigns_freeze_intelligence_versions
before update of intelligence_version, workflow_version on public.campaigns
for each row execute function public.prevent_frozen_intelligence_version_change();

create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_campaign public.campaigns;
  target_profile_intelligence_version text;
  created_run public.campaign_runs;
  frozen_contract_versions jsonb;
  execution_idempotency_key text;
  execution_request_hash text;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into target_campaign
  from public.campaigns
  where workspace_id = target_workspace_id
    and external_id = target_campaign_external_id
  for update;

  if target_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if target_campaign.current_strategy_version_id is null then
    raise exception 'Campaign Strategy is required';
  end if;
  if target_campaign.profile_snapshot_id is null then
    raise exception 'Campaign Profile snapshot is required';
  end if;

  select profile_version.intelligence_version
  into target_profile_intelligence_version
  from public.campaign_profile_snapshots snapshot
  join public.company_profile_versions profile_version
    on profile_version.id = snapshot.company_profile_version_id
  where snapshot.workspace_id = target_workspace_id
    and snapshot.id = target_campaign.profile_snapshot_id;

  if target_profile_intelligence_version is null then
    raise exception 'Campaign Profile intelligence version is missing';
  end if;

  frozen_contract_versions := jsonb_build_object(
    'profileIntelligence', target_profile_intelligence_version,
    'campaignIntelligence', target_campaign.intelligence_version,
    'campaignWorkflow', target_campaign.workflow_version
  );

  insert into public.campaign_runs (
    workspace_id,
    campaign_id,
    strategy_version_id,
    profile_snapshot_id,
    workflow_version,
    contract_versions,
    status,
    current_phase,
    progress_percentage,
    dispatch_state,
    metadata
  ) values (
    target_workspace_id,
    target_campaign.id,
    target_campaign.current_strategy_version_id,
    target_campaign.profile_snapshot_id,
    target_campaign.workflow_version,
    frozen_contract_versions,
    'queued',
    'discovery_queued',
    0,
    'created',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1),
      'workflowVersion',
      target_campaign.workflow_version
    )
  )
  returning * into created_run;

  update public.campaign_runs
  set dispatch_key = 'execute-campaign:' || created_run.id::text
  where id = created_run.id
  returning * into created_run;

  execution_idempotency_key := 'campaign-discovery:' || created_run.id::text;
  execution_request_hash := encode(
    digest(
      created_run.id::text || ':' ||
      target_campaign.workflow_version || ':' ||
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)::text,
      'sha256'
    ),
    'hex'
  );

  insert into public.provider_executions (
    workspace_id,
    campaign_run_id,
    provider,
    operation,
    idempotency_key,
    request_hash,
    status,
    dispatch_state,
    dispatch_key,
    metadata
  ) values (
    target_workspace_id,
    created_run.id,
    'tavily_openrouter',
    'campaign_discovery',
    execution_idempotency_key,
    execution_request_hash,
    'pending',
    'created',
    'provider-dispatch:' || execution_idempotency_key,
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1),
      'workflowVersion',
      target_campaign.workflow_version,
      'contractVersions',
      frozen_contract_versions
    )
  );

  update public.campaign_strategy_versions
  set status = 'used'
  where id = target_campaign.current_strategy_version_id
    and status in ('draft', 'ready');

  insert into public.campaign_run_events (
    workspace_id,
    campaign_run_id,
    event_type,
    phase,
    summary,
    details
  ) values (
    target_workspace_id,
    created_run.id,
    'campaign_run_queued',
    'discovery_queued',
    'Campaign discovery was queued.',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1),
      'workflowVersion',
      target_campaign.workflow_version,
      'contractVersions',
      frozen_contract_versions
    )
  );

  return created_run;
end;
$$;

revoke all on function public.create_clean_campaign_run(uuid, text, integer)
from public, anon;
grant execute on function public.create_clean_campaign_run(uuid, text, integer)
to authenticated;

revoke all on function public.ensure_workspace_intelligence_settings() from public;
revoke all on function public.prevent_frozen_intelligence_version_change() from public;
