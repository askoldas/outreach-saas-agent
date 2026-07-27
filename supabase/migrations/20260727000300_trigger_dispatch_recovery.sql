alter table public.campaign_runs
  add column dispatch_state text not null default 'created'
    check (dispatch_state in (
      'created', 'dispatching', 'dispatched', 'running', 'completed',
      'failed', 'dispatch_failed', 'cancelled'
    )),
  add column dispatch_key text,
  add column dispatch_attempts integer not null default 0
    check (dispatch_attempts >= 0),
  add column dispatch_updated_at timestamptz not null default now(),
  add column last_dispatch_error text;

alter table public.provider_executions
  add column trigger_run_id text unique,
  add column dispatch_state text not null default 'created'
    check (dispatch_state in (
      'created', 'dispatching', 'dispatched', 'running', 'completed',
      'failed', 'dispatch_failed', 'cancelled'
    )),
  add column dispatch_key text,
  add column dispatch_attempts integer not null default 0
    check (dispatch_attempts >= 0),
  add column dispatch_updated_at timestamptz not null default now(),
  add column last_dispatch_error text;

update public.campaign_runs
set
  dispatch_state = case
    when status = 'completed' or status = 'partially_completed' then 'completed'
    when status = 'failed' then 'failed'
    when status = 'cancelled' then 'cancelled'
    when trigger_run_id is not null and started_at is not null then 'running'
    when trigger_run_id is not null then 'dispatched'
    else 'created'
  end,
  dispatch_updated_at = coalesce(started_at, created_at);

update public.campaign_runs
set dispatch_key = 'execute-campaign:' || id::text
where dispatch_key is null;

update public.provider_executions
set
  trigger_run_id = case
    when provider_reference like 'run_%' then provider_reference
    else null
  end,
  dispatch_state = case
    when status = 'completed' then 'completed'
    when status = 'failed' then 'failed'
    when status = 'cancelled' then 'cancelled'
    when status = 'running' then 'running'
    when provider_reference like 'run_%' then 'dispatched'
    else 'created'
  end,
  dispatch_updated_at = coalesce(started_at, created_at);

update public.provider_executions
set dispatch_key = 'provider-dispatch:' || idempotency_key
where dispatch_key is null;

create index campaign_runs_recoverable_dispatch_idx
  on public.campaign_runs(workspace_id, dispatch_state, dispatch_updated_at)
  where dispatch_state in ('created', 'dispatching', 'dispatch_failed', 'dispatched');

create index provider_executions_recoverable_dispatch_idx
  on public.provider_executions(workspace_id, dispatch_state, dispatch_updated_at)
  where dispatch_state in ('created', 'dispatching', 'dispatch_failed', 'dispatched');

create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  created_run public.campaign_runs;
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

  insert into public.campaign_runs (
    workspace_id,
    campaign_id,
    strategy_version_id,
    profile_snapshot_id,
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
    'queued',
    'discovery_queued',
    0,
    'created',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
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
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
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
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  );

  return created_run;
end;
$$;
