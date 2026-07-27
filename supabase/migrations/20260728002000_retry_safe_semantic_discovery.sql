-- Retry-safe Campaign Memory and Semantic Discovery V2 execution.
-- Apply after 20260728001900_allow_service_role_workspace_admin.sql.

alter table public.campaign_memory_snapshots
add column campaign_run_id uuid
references public.campaign_runs(id) on delete cascade;

alter table public.discovery_plans_v2
add column campaign_run_id uuid
references public.campaign_runs(id) on delete cascade;

alter table public.discovery_runs_v2
add column campaign_run_id uuid
references public.campaign_runs(id) on delete cascade;

-- A plan is frozen for one Campaign Run. The old Campaign/version uniqueness
-- prevented a second run from freezing a new Memory snapshot.
alter table public.discovery_plans_v2
drop constraint if exists discovery_plans_v2_campaign_id_version_number_key;

create unique index campaign_memory_snapshots_campaign_run_uidx
on public.campaign_memory_snapshots(campaign_run_id)
where campaign_run_id is not null;

create unique index discovery_plans_v2_campaign_run_uidx
on public.discovery_plans_v2(campaign_run_id)
where campaign_run_id is not null;

create unique index discovery_runs_v2_campaign_run_uidx
on public.discovery_runs_v2(campaign_run_id)
where campaign_run_id is not null;

-- Domain gap IDs are stable semantic keys such as "segment:language_not_attempted".
alter table public.discovery_segment_runs_v2
alter column gap_ids drop default;

alter table public.discovery_segment_runs_v2
alter column gap_ids type text[]
using gap_ids::text[];

alter table public.discovery_segment_runs_v2
alter column gap_ids set default '{}'::text[];

do $$
begin
  if exists (
    select 1
    from public.discovery_coverage_snapshots_v2
    group by discovery_segment_run_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate Semantic Discovery coverage snapshots must be reviewed before Migration 20.';
  end if;
  if exists (
    select 1
    from public.memory_application_events
    where memory_snapshot_id is not null
    group by memory_snapshot_id, memory_id, applied_to_type, applied_to_id
    having count(*) > 1
  ) then
    raise exception
      'Duplicate Memory application events must be reviewed before Migration 20.';
  end if;
end;
$$;

create unique index discovery_coverage_snapshots_v2_segment_run_uidx
on public.discovery_coverage_snapshots_v2(discovery_segment_run_id);

alter table public.discovery_coverage_snapshots_v2
add column settlement_hash text
check (settlement_hash is null or length(settlement_hash) = 64);

alter table public.memory_application_events
add constraint memory_application_events_snapshot_target_key
unique (memory_snapshot_id, memory_id, applied_to_type, applied_to_id);

alter table public.discovery_gap_actions_v2
add column action_fingerprint text
check (action_fingerprint is null or length(action_fingerprint) = 64);

create unique index discovery_gap_actions_v2_fingerprint_uidx
on public.discovery_gap_actions_v2(discovery_gap_id, action_fingerprint)
where action_fingerprint is not null;

create table public.discovery_pass_decisions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null references public.discovery_runs_v2(id) on delete cascade,
  pass_number integer not null check (pass_number > 0),
  expected_segment_run_ids uuid[] not null,
  coverage_summary_json jsonb not null
    check (jsonb_typeof(coverage_summary_json) = 'object'),
  usage_summary_json jsonb not null
    check (jsonb_typeof(usage_summary_json) = 'object'),
  decision_json jsonb not null check (jsonb_typeof(decision_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (discovery_run_id, pass_number)
);

create table public.discovery_query_plans_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_segment_run_id uuid not null
    references public.discovery_segment_runs_v2(id) on delete cascade,
  provider_key text not null,
  adapter_version text not null,
  request_json jsonb not null check (jsonb_typeof(request_json) = 'object'),
  queries_json jsonb not null check (jsonb_typeof(queries_json) = 'array'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (discovery_segment_run_id, provider_key)
);

create or replace function public.validate_campaign_memory_snapshot_run_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.campaign_run_id is null then return new; end if;
  if not exists (
    select 1
    from public.campaign_runs campaign_run
    where campaign_run.id = new.campaign_run_id
      and campaign_run.workspace_id = new.workspace_id
      and campaign_run.campaign_id = new.campaign_id
      and campaign_run.strategy_version_id = new.campaign_strategy_version_id
      and campaign_run.workflow_version = 'v2'
  ) then
    raise exception 'Campaign Memory snapshot Campaign Run mismatch.';
  end if;
  return new;
end;
$$;

create trigger campaign_memory_snapshots_campaign_run_guard
before insert or update of
  campaign_run_id, workspace_id, campaign_id, campaign_strategy_version_id
on public.campaign_memory_snapshots
for each row execute function public.validate_campaign_memory_snapshot_run_v2();

create or replace function public.validate_discovery_plan_campaign_run_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.campaign_run_id is null then return new; end if;
  if not exists (
    select 1
    from public.campaign_runs campaign_run
    join public.campaign_memory_snapshots memory_snapshot
      on memory_snapshot.id = new.memory_snapshot_id
      and memory_snapshot.campaign_run_id = campaign_run.id
    where campaign_run.id = new.campaign_run_id
      and campaign_run.workspace_id = new.workspace_id
      and campaign_run.campaign_id = new.campaign_id
      and campaign_run.strategy_version_id = new.campaign_strategy_version_id
      and campaign_run.workflow_version = 'v2'
  ) then
    raise exception 'Semantic Discovery Plan Campaign Run mismatch.';
  end if;
  return new;
end;
$$;

create trigger discovery_plans_v2_campaign_run_guard
before insert or update of
  campaign_run_id, workspace_id, campaign_id,
  campaign_strategy_version_id, memory_snapshot_id
on public.discovery_plans_v2
for each row execute function public.validate_discovery_plan_campaign_run_v2();

create or replace function public.validate_discovery_campaign_run_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.campaign_run_id is null then return new; end if;
  if not exists (
    select 1
    from public.campaign_runs campaign_run
    join public.discovery_plans_v2 plan
      on plan.id = new.discovery_plan_id
      and plan.campaign_run_id = campaign_run.id
    where campaign_run.id = new.campaign_run_id
      and campaign_run.workspace_id = new.workspace_id
      and campaign_run.campaign_id = new.campaign_id
      and campaign_run.strategy_version_id = plan.campaign_strategy_version_id
      and campaign_run.workflow_version = 'v2'
  ) then
    raise exception 'Semantic Discovery Campaign Run mismatch.';
  end if;
  return new;
end;
$$;

create trigger discovery_runs_v2_campaign_run_guard
before insert or update of
  campaign_run_id, discovery_plan_id, campaign_id, workspace_id
on public.discovery_runs_v2
for each row execute function public.validate_discovery_campaign_run_v2();

create or replace function public.validate_discovery_pass_decision_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.discovery_runs_v2 discovery_run
    where discovery_run.id = new.discovery_run_id
      and discovery_run.workspace_id = new.workspace_id
  ) then
    raise exception 'Cross-workspace Semantic Discovery pass decision.';
  end if;
  return new;
end;
$$;

create trigger discovery_pass_decisions_v2_workspace_guard
before insert or update
on public.discovery_pass_decisions_v2
for each row execute function public.validate_discovery_pass_decision_v2();

create or replace function public.validate_discovery_query_plan_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.discovery_segment_runs_v2 segment_run
    join public.discovery_segments_v2 segment
      on segment.id = segment_run.discovery_segment_id
    join public.discovery_source_plans_v2 source_plan
      on source_plan.discovery_segment_id = segment.id
      and source_plan.provider_key = new.provider_key
    join public.discovery_provider_capability_snapshots capability
      on capability.id = source_plan.capability_snapshot_id
      and capability.adapter_version = new.adapter_version
    where segment_run.id = new.discovery_segment_run_id
      and segment_run.workspace_id = new.workspace_id
      and source_plan.workspace_id = new.workspace_id
  ) then
    raise exception 'Semantic Discovery query plan association mismatch.';
  end if;
  return new;
end;
$$;

create trigger discovery_query_plans_v2_workspace_guard
before insert or update
on public.discovery_query_plans_v2
for each row execute function public.validate_discovery_query_plan_v2();

alter table public.discovery_pass_decisions_v2 enable row level security;
alter table public.discovery_query_plans_v2 enable row level security;

create policy "Members can read discovery_pass_decisions_v2"
on public.discovery_pass_decisions_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Admins can manage discovery_pass_decisions_v2"
on public.discovery_pass_decisions_v2
for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Members can read discovery_query_plans_v2"
on public.discovery_query_plans_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Admins can manage discovery_query_plans_v2"
on public.discovery_query_plans_v2
for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

grant select on public.discovery_pass_decisions_v2 to authenticated;
grant select on public.discovery_query_plans_v2 to authenticated;

create or replace function public.load_campaign_run_memory_snapshot_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  saved_snapshot jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  select to_jsonb(memory_snapshot) into saved_snapshot
  from public.campaign_memory_snapshots memory_snapshot
  where memory_snapshot.workspace_id = target_workspace_id
    and memory_snapshot.campaign_run_id = target_campaign_run_id;
  return saved_snapshot;
end;
$$;

create or replace function public.freeze_campaign_run_memory_snapshot_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_strategy_version_id uuid,
  target_snapshot jsonb,
  target_content_hash text
)
returns public.campaign_memory_snapshots
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  saved_snapshot public.campaign_memory_snapshots;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and strategy_version_id = target_strategy_version_id
    and workflow_version = 'v2'
  for update;
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into saved_snapshot
  from public.campaign_memory_snapshots
  where campaign_run_id = campaign_run.id;
  if saved_snapshot.id is not null then return saved_snapshot; end if;

  if target_snapshot#>>'{context,runId}' <> campaign_run.id::text
    or target_snapshot#>>'{context,campaignId}' <> campaign_run.campaign_id::text
    or target_snapshot#>>'{context,workspaceId}' <> target_workspace_id::text
  then
    raise exception 'Campaign Memory snapshot context mismatch.';
  end if;

  insert into public.campaign_memory_snapshots (
    workspace_id,
    campaign_id,
    campaign_strategy_version_id,
    campaign_run_id,
    snapshot_json,
    content_hash
  ) values (
    target_workspace_id,
    campaign_run.campaign_id,
    target_strategy_version_id,
    campaign_run.id,
    target_snapshot,
    target_content_hash
  )
  returning * into saved_snapshot;

  return saved_snapshot;
end;
$$;

create or replace function public.create_campaign_discovery_plan_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_plan jsonb,
  target_content_hash text
)
returns public.discovery_plans_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  saved_plan public.discovery_plans_v2;
  target_memory_snapshot_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2'
  for update;
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into saved_plan
  from public.discovery_plans_v2
  where campaign_run_id = campaign_run.id;
  if saved_plan.id is not null then return saved_plan; end if;

  target_memory_snapshot_id := (target_plan->>'memorySnapshotId')::uuid;
  if target_plan->>'campaignId' <> campaign_run.campaign_id::text
    or target_plan->>'campaignStrategyVersionId'
      <> campaign_run.strategy_version_id::text
    or target_plan->>'contentHash' <> target_content_hash
    or not exists (
      select 1
      from public.campaign_memory_snapshots memory_snapshot
      where memory_snapshot.id = target_memory_snapshot_id
        and memory_snapshot.campaign_run_id = campaign_run.id
        and memory_snapshot.workspace_id = target_workspace_id
        and memory_snapshot.campaign_id = campaign_run.campaign_id
        and memory_snapshot.campaign_strategy_version_id
          = campaign_run.strategy_version_id
    )
  then
    raise exception 'Campaign Discovery Plan identity mismatch.';
  end if;

  saved_plan := public.create_discovery_plan_v2(
    target_workspace_id,
    campaign_run.campaign_id,
    campaign_run.strategy_version_id,
    target_memory_snapshot_id,
    target_plan,
    target_content_hash
  );

  if saved_plan.campaign_run_id is not null
    and saved_plan.campaign_run_id <> campaign_run.id
  then
    raise exception 'Discovery Plan is already frozen for another Campaign Run.';
  end if;

  update public.discovery_plans_v2
  set campaign_run_id = campaign_run.id
  where id = saved_plan.id
  returning * into saved_plan;

  return saved_plan;
end;
$$;

create or replace function public.load_campaign_discovery_plan_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  saved_plan jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  select to_jsonb(plan) into saved_plan
  from public.discovery_plans_v2 plan
  where plan.workspace_id = target_workspace_id
    and plan.campaign_run_id = target_campaign_run_id;
  return saved_plan;
end;
$$;

create or replace function public.start_campaign_discovery_run_v2(
  target_workspace_id uuid,
  target_plan_id uuid,
  target_campaign_run_id uuid
)
returns public.discovery_runs_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  plan public.discovery_plans_v2;
  campaign_run public.campaign_runs;
  saved_run public.discovery_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2'
  for update;
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into saved_run
  from public.discovery_runs_v2
  where campaign_run_id = campaign_run.id;
  if saved_run.id is not null then
    if saved_run.discovery_plan_id <> target_plan_id then
      raise exception 'Campaign Run is already linked to another Discovery Plan.';
    end if;
    return saved_run;
  end if;

  select * into plan
  from public.discovery_plans_v2
  where id = target_plan_id
    and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and campaign_strategy_version_id = campaign_run.strategy_version_id
    and campaign_run_id = campaign_run.id
    and status in ('ready', 'running')
  for update;
  if plan.id is null then
    raise exception 'Frozen Semantic Discovery Plan not found.';
  end if;

  insert into public.discovery_runs_v2 (
    workspace_id,
    discovery_plan_id,
    campaign_id,
    campaign_run_id,
    status,
    budget_limit_json
  ) values (
    target_workspace_id,
    plan.id,
    campaign_run.campaign_id,
    campaign_run.id,
    'running_initial_pass',
    plan.budget_policy_json
  )
  returning * into saved_run;

  update public.discovery_plans_v2
  set status = 'running'
  where id = plan.id;

  return saved_run;
end;
$$;

create or replace function public.start_discovery_segment_pass_once_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_segment_id uuid,
  target_pass_number integer,
  target_gap_keys text[] default '{}'
)
returns public.discovery_segment_runs_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  discovery_run public.discovery_runs_v2;
  saved_run public.discovery_segment_runs_v2;
  canonical_gap_keys text[];
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_pass_number < 1 then
    raise exception 'Semantic Discovery pass number must be positive.';
  end if;
  if target_gap_keys is null or cardinality(target_gap_keys) <> (
    select count(distinct gap_key)
    from unnest(target_gap_keys) as requested_gap(gap_key)
  ) then
    raise exception 'Semantic Discovery gap keys must be unique.';
  end if;
  select coalesce(
    array_agg(requested.gap_key order by requested.gap_key),
    '{}'::text[]
  )
  into canonical_gap_keys
  from unnest(target_gap_keys) requested(gap_key);

  select * into discovery_run
  from public.discovery_runs_v2
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;
  if discovery_run.id is null then
    raise exception 'Semantic Discovery Run not found.';
  end if;
  if not exists (
    select 1
    from public.discovery_segments_v2 segment
    where segment.id = target_segment_id
      and segment.workspace_id = target_workspace_id
      and segment.discovery_plan_id = discovery_run.discovery_plan_id
  ) then
    raise exception 'Semantic Discovery Segment does not belong to the Run.';
  end if;

  select * into saved_run
  from public.discovery_segment_runs_v2
  where discovery_run_id = target_run_id
    and discovery_segment_id = target_segment_id
    and pass_number = target_pass_number
  for update;
  if saved_run.id is not null then
    if coalesce(saved_run.gap_ids, '{}'::text[])
      <> canonical_gap_keys
    then
      raise exception 'Semantic Discovery pass retry changed its gap keys.';
    end if;
    return saved_run;
  end if;

  if target_pass_number = 1 and cardinality(canonical_gap_keys) > 0 then
    raise exception 'The initial Semantic Discovery pass cannot target prior gaps.';
  end if;
  if target_pass_number > 1 and cardinality(canonical_gap_keys) = 0 then
    raise exception 'A targeted Semantic Discovery pass requires at least one gap.';
  end if;
  if (
    target_pass_number = 1
    and discovery_run.status <> 'running_initial_pass'
  ) or (
    target_pass_number > 1
    and discovery_run.status <> 'running_targeted_pass'
  ) then
    raise exception 'Semantic Discovery Run cannot start this pass.';
  end if;
  if target_pass_number > 1 and not exists (
    select 1
    from public.discovery_pass_decisions_v2 prior_pass
    where prior_pass.discovery_run_id = target_run_id
      and prior_pass.pass_number = target_pass_number - 1
      and prior_pass.decision_json->>'decision' = 'continue'
  ) then
    raise exception 'Semantic Discovery pass sequence is incomplete.';
  end if;
  if target_pass_number > 1 and exists (
    select 1
    from unnest(canonical_gap_keys) requested(gap_key)
    where not exists (
      select 1
      from public.discovery_gaps_v2 gap
      where gap.discovery_run_id = target_run_id
        and gap.gap_key = requested.gap_key
        and gap.status in ('open', 'addressing')
        and (
          gap.discovery_segment_id is null
          or gap.discovery_segment_id = target_segment_id
        )
    )
  ) then
    raise exception 'Targeted pass references an unavailable Discovery gap.';
  end if;

  insert into public.discovery_segment_runs_v2 (
    workspace_id,
    discovery_run_id,
    discovery_segment_id,
    pass_number,
    gap_ids,
    status
  ) values (
    target_workspace_id,
    target_run_id,
    target_segment_id,
    target_pass_number,
    canonical_gap_keys,
    'running'
  )
  returning * into saved_run;

  update public.discovery_segments_v2
  set status = 'running'
  where id = target_segment_id;

  return saved_run;
end;
$$;

create or replace function public.freeze_discovery_query_plan_v2(
  target_workspace_id uuid,
  target_segment_run_id uuid,
  target_provider_key text,
  target_adapter_version text,
  target_request jsonb,
  target_queries jsonb,
  target_content_hash text
)
returns public.discovery_query_plans_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  segment_run public.discovery_segment_runs_v2;
  segment public.discovery_segments_v2;
  discovery_run public.discovery_runs_v2;
  saved_plan public.discovery_query_plans_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into segment_run
  from public.discovery_segment_runs_v2
  where id = target_segment_run_id
    and workspace_id = target_workspace_id
  for update;
  if segment_run.id is null then
    raise exception 'Semantic Discovery Segment Run not found.';
  end if;
  select * into segment
  from public.discovery_segments_v2
  where id = segment_run.discovery_segment_id;
  select * into discovery_run
  from public.discovery_runs_v2
  where id = segment_run.discovery_run_id;

  select * into saved_plan
  from public.discovery_query_plans_v2
  where discovery_segment_run_id = segment_run.id
    and provider_key = target_provider_key;
  if saved_plan.id is not null then return saved_plan; end if;

  if nullif(btrim(target_provider_key), '') is null
    or nullif(btrim(target_adapter_version), '') is null
    or target_content_hash is null
    or target_content_hash !~ '^[0-9a-f]{64}$'
    or jsonb_typeof(target_request) is distinct from 'object'
    or jsonb_typeof(target_queries) is distinct from 'array'
    or target_request->>'workspaceId'
      is distinct from target_workspace_id::text
    or target_request->>'campaignId'
      is distinct from discovery_run.campaign_id::text
    or target_request#>>'{segment,id}'
      is distinct from segment.segment_key
    or target_request->>'discoveryPlanId'
      is distinct from discovery_run.discovery_plan_id::text
    or target_request#>>'{executionContext,passNumber}'
      is distinct from segment_run.pass_number::text
  then
    raise exception 'Semantic Discovery query plan identity mismatch.';
  end if;

  insert into public.discovery_query_plans_v2 (
    workspace_id,
    discovery_segment_run_id,
    provider_key,
    adapter_version,
    request_json,
    queries_json,
    content_hash
  ) values (
    target_workspace_id,
    segment_run.id,
    target_provider_key,
    target_adapter_version,
    target_request,
    target_queries,
    target_content_hash
  )
  returning * into saved_plan;

  return saved_plan;
end;
$$;

create or replace function public.record_discovery_query_audit_v2(
  target_workspace_id uuid,
  target_provider_execution_id uuid,
  target_segment_run_id uuid,
  target_queries jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_execution public.discovery_provider_executions;
  segment_run public.discovery_segment_runs_v2;
  segment public.discovery_segments_v2;
  query_plan public.discovery_query_plans_v2;
  existing_query public.discovery_queries_v2;
  query_record jsonb;
  incoming_status text;
  incoming_count integer;
  settled_count integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into provider_execution
  from public.discovery_provider_executions
  where id = target_provider_execution_id
    and workspace_id = target_workspace_id
  for update;
  if provider_execution.id is null then
    raise exception 'Provider execution not found.';
  end if;
  if provider_execution.status <> 'completed' then
    raise exception 'Provider execution is not complete.';
  end if;

  select * into segment_run
  from public.discovery_segment_runs_v2
  where id = target_segment_run_id
    and workspace_id = target_workspace_id;
  if segment_run.id is null then
    raise exception 'Semantic Discovery Segment Run not found.';
  end if;
  select * into segment
  from public.discovery_segments_v2
  where id = segment_run.discovery_segment_id;

  if provider_execution.discovery_segment_run_id is not null
    and provider_execution.discovery_segment_run_id <> target_segment_run_id
  then
    raise exception 'Provider execution is already linked to another Segment Run.';
  end if;
  if provider_execution.discovery_segment_key <> segment.segment_key
    or not exists (
      select 1
      from public.discovery_runs_v2 discovery_run
      where discovery_run.id = segment_run.discovery_run_id
        and discovery_run.campaign_id = provider_execution.campaign_id
    )
  then
    raise exception 'Provider execution does not match the Semantic Discovery segment.';
  end if;
  select * into query_plan
  from public.discovery_query_plans_v2
  where workspace_id = target_workspace_id
    and discovery_segment_run_id = target_segment_run_id
    and provider_key = provider_execution.provider_key
    and adapter_version = provider_execution.adapter_version;
  if query_plan.id is null
    or jsonb_typeof(target_queries) is distinct from 'array'
    or jsonb_array_length(target_queries)
      <> jsonb_array_length(query_plan.queries_json)
    or jsonb_array_length(target_queries) <> (
      select count(distinct incoming.incoming_query->>'fingerprint')
      from jsonb_array_elements(target_queries) incoming(incoming_query)
    )
  then
    raise exception 'Provider execution has no matching frozen query plan.';
  end if;

  update public.discovery_provider_executions
  set discovery_segment_run_id = target_segment_run_id
  where id = provider_execution.id
    and discovery_segment_run_id is null;

  for query_record in select * from jsonb_array_elements(target_queries) loop
    if not exists (
      select 1
      from jsonb_array_elements(query_plan.queries_json) frozen(frozen_query)
      where frozen.frozen_query->>'id' is not distinct from query_record->>'id'
        and frozen.frozen_query->>'campaignId'
          is not distinct from query_record->>'campaignId'
        and frozen.frozen_query->>'discoverySegmentId'
          is not distinct from query_record->>'discoverySegmentId'
        and frozen.frozen_query->>'query'
          is not distinct from query_record->>'query'
        and frozen.frozen_query->>'normalizedQuery'
          is not distinct from query_record->>'normalizedQuery'
        and frozen.frozen_query->>'fingerprint'
          is not distinct from query_record->>'fingerprint'
        and frozen.frozen_query->>'language'
          is not distinct from query_record->>'language'
        and frozen.frozen_query->>'country'
          is not distinct from query_record->>'country'
        and frozen.frozen_query->>'family'
          is not distinct from query_record->>'family'
        and frozen.frozen_query->>'purpose'
          is not distinct from query_record->>'purpose'
        and frozen.frozen_query->>'priority'
          is not distinct from query_record->>'priority'
    ) then
      raise exception 'Settled Discovery query does not match its frozen plan.';
    end if;
    incoming_status := coalesce(query_record->>'status', 'completed');
    incoming_count := coalesce(nullif(query_record->>'resultCount', '')::integer, 0);
    if incoming_status not in (
      'planned', 'running', 'completed', 'failed',
      'skipped_duplicate', 'skipped_budget'
    ) or incoming_count < 0 then
      raise exception 'Invalid settled Discovery query state.';
    end if;

    select * into existing_query
    from public.discovery_queries_v2
    where provider_execution_id = target_provider_execution_id
      and fingerprint = query_record->>'fingerprint'
    for update;

    if existing_query.id is null then
      insert into public.discovery_queries_v2 (
        workspace_id,
        provider_execution_id,
        query_key,
        query_text,
        normalized_query,
        fingerprint,
        language,
        country,
        query_type,
        purpose,
        sequence_number,
        status,
        result_count
      ) values (
        target_workspace_id,
        target_provider_execution_id,
        query_record->>'id',
        query_record->>'query',
        query_record->>'normalizedQuery',
        query_record->>'fingerprint',
        query_record->>'language',
        query_record->>'country',
        query_record->>'family',
        query_record->>'purpose',
        (query_record->>'priority')::integer,
        incoming_status,
        incoming_count
      );
      settled_count := settled_count + 1;
    else
      if existing_query.query_key <> query_record->>'id'
        or existing_query.query_text <> query_record->>'query'
        or existing_query.normalized_query <> query_record->>'normalizedQuery'
        or existing_query.language <> query_record->>'language'
        or existing_query.country is distinct from query_record->>'country'
        or existing_query.query_type <> query_record->>'family'
        or existing_query.purpose <> query_record->>'purpose'
        or existing_query.sequence_number <> (query_record->>'priority')::integer
      then
        raise exception 'Discovery query fingerprint was reused with different content.';
      end if;

      if existing_query.status = incoming_status
        and existing_query.result_count = incoming_count
      then
        null;
      elsif existing_query.status in ('planned', 'running')
        and incoming_status in (
          'completed', 'failed', 'skipped_duplicate', 'skipped_budget'
        )
      then
        update public.discovery_queries_v2
        set status = incoming_status, result_count = incoming_count
        where id = existing_query.id;
        settled_count := settled_count + 1;
      else
        raise exception 'Settled Discovery query retry changed its result.';
      end if;
    end if;
    existing_query := null;
  end loop;

  return settled_count;
end;
$$;

create or replace function public.persist_discovery_segment_coverage_once_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_segment_run_id uuid,
  target_coverage jsonb,
  target_gaps jsonb
)
returns public.discovery_coverage_snapshots_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  segment_run public.discovery_segment_runs_v2;
  segment public.discovery_segments_v2;
  discovery_run public.discovery_runs_v2;
  existing_snapshot public.discovery_coverage_snapshots_v2;
  saved_snapshot public.discovery_coverage_snapshots_v2;
  saved_gap public.discovery_gaps_v2;
  saved_action public.discovery_gap_actions_v2;
  gap jsonb;
  action jsonb;
  target_settlement_hash text;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into segment_run
  from public.discovery_segment_runs_v2
  where id = target_segment_run_id
    and workspace_id = target_workspace_id
    and discovery_run_id = target_run_id
  for update;
  if segment_run.id is null then
    raise exception 'Semantic Discovery Segment Run not found.';
  end if;
  select * into segment
  from public.discovery_segments_v2
  where id = segment_run.discovery_segment_id;
  select * into discovery_run
  from public.discovery_runs_v2
  where id = target_run_id;

  if target_coverage->>'campaignId' <> discovery_run.campaign_id::text
    or target_coverage->>'discoverySegmentId' <> segment.segment_key
    or target_coverage->>'archetypeId' <> segment.campaign_archetype_key
  then
    raise exception 'Semantic Discovery coverage identity mismatch.';
  end if;

  target_settlement_hash := encode(
    digest(
      jsonb_build_object(
        'coverage', target_coverage,
        'gaps', target_gaps
      )::text,
      'sha256'
    ),
    'hex'
  );
  select * into existing_snapshot
  from public.discovery_coverage_snapshots_v2
  where discovery_segment_run_id = target_segment_run_id
  for update;
  if existing_snapshot.id is not null then
    if existing_snapshot.metrics_json <> target_coverage
      or (
        existing_snapshot.settlement_hash is not null
        and existing_snapshot.settlement_hash <> target_settlement_hash
      )
    then
      raise exception 'Semantic Discovery coverage retry changed settled work.';
    end if;
    if existing_snapshot.settlement_hash is not null then
      return existing_snapshot;
    end if;
    update public.discovery_coverage_snapshots_v2
    set settlement_hash = target_settlement_hash
    where id = existing_snapshot.id
    returning * into saved_snapshot;
  else
    insert into public.discovery_coverage_snapshots_v2 (
      workspace_id,
      discovery_run_id,
      discovery_segment_run_id,
      archetype_key,
      geography_key,
      metrics_json,
      confidence,
      status,
      reasons_json,
      settlement_hash
    ) values (
      target_workspace_id,
      target_run_id,
      target_segment_run_id,
      target_coverage->>'archetypeId',
      target_coverage->>'geographyKey',
      target_coverage,
      (target_coverage->>'confidence')::numeric,
      target_coverage->>'status',
      target_coverage->'reasons',
      target_settlement_hash
    )
    returning * into saved_snapshot;
  end if;

  for gap in select * from jsonb_array_elements(target_gaps) loop
    if gap->>'campaignId' <> discovery_run.campaign_id::text
      or gap->>'discoverySegmentId' <> segment.segment_key
    then
      raise exception 'Semantic Discovery gap identity mismatch.';
    end if;

    select * into saved_gap
    from public.discovery_gaps_v2
    where discovery_run_id = target_run_id
      and gap_key = gap->>'id'
    for update;
    if saved_gap.id is null then
      insert into public.discovery_gaps_v2 (
        workspace_id,
        discovery_run_id,
        discovery_segment_id,
        gap_key,
        gap_type,
        description,
        supporting_metrics_json,
        severity,
        status
      ) values (
        target_workspace_id,
        target_run_id,
        segment.id,
        gap->>'id',
        gap->>'type',
        gap->>'description',
        gap->'supportingMetrics',
        gap->>'severity',
        gap->>'status'
      )
      returning * into saved_gap;
    else
      if saved_gap.discovery_segment_id <> segment.id
        or saved_gap.gap_type <> gap->>'type'
        or saved_gap.description <> gap->>'description'
      then
        raise exception 'Semantic Discovery gap key changed immutable identity.';
      end if;
      update public.discovery_gaps_v2
      set
        supporting_metrics_json = gap->'supportingMetrics',
        severity = gap->>'severity',
        status = gap->>'status'
      where id = saved_gap.id
      returning * into saved_gap;
    end if;

    for action in select * from jsonb_array_elements(gap->'recommendedActions') loop
      select * into saved_action
      from public.discovery_gap_actions_v2 existing_action
      where existing_action.discovery_gap_id = saved_gap.id
        and existing_action.action_type = action->>'type'
        and existing_action.reason = action->>'reason'
        and existing_action.expected_improvement = action->>'expectedImprovement'
        and existing_action.max_calls is not distinct from
          nullif(action->>'maxCalls', '')::integer
        and existing_action.max_estimated_cost_minor is not distinct from
          nullif(action->>'maxEstimatedCostMinor', '')::numeric
      order by
        (existing_action.action_fingerprint is not null) desc,
        existing_action.created_at,
        existing_action.id
      limit 1
      for update;
      if saved_action.id is null then
        insert into public.discovery_gap_actions_v2 (
          workspace_id,
          discovery_gap_id,
          action_type,
          reason,
          expected_improvement,
          max_calls,
          max_estimated_cost_minor,
          action_fingerprint
        ) values (
          target_workspace_id,
          saved_gap.id,
          action->>'type',
          action->>'reason',
          action->>'expectedImprovement',
          nullif(action->>'maxCalls', '')::integer,
          nullif(action->>'maxEstimatedCostMinor', '')::numeric,
          encode(digest(action::text, 'sha256'), 'hex')
        )
        on conflict do nothing;
      elsif saved_action.action_fingerprint is null then
        update public.discovery_gap_actions_v2
        set action_fingerprint = encode(digest(action::text, 'sha256'), 'hex')
        where id = saved_action.id;
      end if;
      saved_action := null;
    end loop;
    saved_gap := null;
  end loop;

  update public.discovery_segment_runs_v2
  set
    status = case target_coverage->>'status'
      when 'sufficient' then 'coverage_sufficient'
      when 'exhausted' then 'exhausted'
      when 'blocked' then 'blocked'
      else 'coverage_insufficient'
    end,
    completed_at = now(),
    metrics_json = target_coverage,
    provider_record_count = (target_coverage->>'rawRecords')::integer,
    normalized_candidate_count =
      (target_coverage->>'normalizedCandidates')::integer,
    unique_candidate_count =
      (target_coverage->>'uniqueCandidateHints')::integer
  where id = target_segment_run_id;

  update public.discovery_segments_v2
  set status = case target_coverage->>'status'
    when 'sufficient' then 'coverage_sufficient'
    when 'exhausted' then 'exhausted'
    when 'blocked' then 'blocked'
    else 'coverage_insufficient'
  end
  where id = segment.id;

  return saved_snapshot;
end;
$$;

create or replace function public.finalize_discovery_pass_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_pass_number integer,
  target_expected_segment_run_ids uuid[],
  target_coverage_summary jsonb,
  target_usage_summary jsonb,
  target_decision jsonb
)
returns public.discovery_runs_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  discovery_run public.discovery_runs_v2;
  existing_decision public.discovery_pass_decisions_v2;
  canonical_expected_segment_run_ids uuid[];
  expected_count integer;
  started_count integer;
  matched_count integer;
  settled_count integer;
  plan_segment_count integer;
  run_status text;
  decision_hash text;
  decision_kind text;
  reason_code text;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_pass_number is null or target_pass_number < 1 then
    raise exception 'Semantic Discovery pass number must be positive.';
  end if;
  if jsonb_typeof(target_coverage_summary) is distinct from 'object'
    or jsonb_typeof(target_usage_summary) is distinct from 'object'
    or jsonb_typeof(target_decision) is distinct from 'object'
  then
    raise exception 'Semantic Discovery pass summary must contain JSON objects.';
  end if;
  if target_expected_segment_run_ids is null
    or cardinality(target_expected_segment_run_ids) = 0
  then
    raise exception 'Semantic Discovery pass requires expected Segment Runs.';
  end if;
  if exists (
    select 1
    from unnest(target_expected_segment_run_ids) expected(segment_run_id)
    where expected.segment_run_id is null
  ) or cardinality(target_expected_segment_run_ids) <> (
    select count(distinct expected.segment_run_id)
    from unnest(target_expected_segment_run_ids) expected(segment_run_id)
  ) then
    raise exception 'Expected Semantic Discovery Segment Runs must be unique.';
  end if;

  select array_agg(expected.segment_run_id order by expected.segment_run_id)
  into canonical_expected_segment_run_ids
  from unnest(target_expected_segment_run_ids) expected(segment_run_id);
  expected_count := cardinality(canonical_expected_segment_run_ids);

  decision_kind := target_decision->>'decision';
  reason_code := target_decision->>'reasonCode';
  if coalesce(decision_kind, '') not in (
    'continue', 'stop', 'pause', 'request_user_input'
  ) then
    raise exception 'Unsupported Semantic Discovery pass decision.';
  end if;
  if coalesce(reason_code, '') not in (
    'target_reached', 'coverage_sufficient', 'budget_exhausted',
    'deadline_reached', 'user_stopped', 'fatal_provider_failure',
    'marginal_yield_low', 'market_exhausted', 'no_actionable_gaps',
    'safety_pass_ceiling', 'actionable_gap', 'strategy_ambiguity'
  ) then
    raise exception 'Unsupported Semantic Discovery pass decision reason.';
  end if;
  if nullif(btrim(target_decision->>'rationale'), '') is null
    or jsonb_typeof(target_decision->'selectedGapIds') is distinct from 'array'
    or jsonb_typeof(target_decision->'selectedActions') is distinct from 'array'
  then
    raise exception 'Semantic Discovery decision payload is incomplete.';
  end if;
  if (
    decision_kind = 'continue' and reason_code <> 'actionable_gap'
  ) or (
    decision_kind = 'pause' and reason_code <> 'user_stopped'
  ) or (
    decision_kind = 'request_user_input'
    and reason_code <> 'strategy_ambiguity'
  ) or (
    decision_kind = 'stop'
    and reason_code in ('actionable_gap', 'strategy_ambiguity')
  ) then
    raise exception 'Semantic Discovery decision and reason do not agree.';
  end if;
  if (
    decision_kind in ('continue', 'request_user_input')
    and jsonb_array_length(target_decision->'selectedGapIds') = 0
  ) or (
    decision_kind = 'continue'
    and jsonb_array_length(target_decision->'selectedActions') = 0
  ) then
    raise exception 'Semantic Discovery continuation requires selected gap actions.';
  end if;

  select * into discovery_run
  from public.discovery_runs_v2
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;
  if discovery_run.id is null then
    raise exception 'Semantic Discovery Run not found.';
  end if;

  decision_hash := encode(
    digest(
      jsonb_build_object(
        'expectedSegmentRunIds', to_jsonb(canonical_expected_segment_run_ids),
        'coverage', target_coverage_summary,
        'usage', target_usage_summary,
        'decision', target_decision
      )::text,
      'sha256'
    ),
    'hex'
  );
  select * into existing_decision
  from public.discovery_pass_decisions_v2
  where discovery_run_id = target_run_id
    and pass_number = target_pass_number
  for update;
  if existing_decision.id is not null then
    if existing_decision.content_hash <> decision_hash
      or existing_decision.expected_segment_run_ids
        <> canonical_expected_segment_run_ids
    then
      raise exception 'Semantic Discovery pass retry changed its final decision.';
    end if;
    return discovery_run;
  end if;

  if (
    target_pass_number = 1
    and discovery_run.status <> 'running_initial_pass'
  ) or (
    target_pass_number > 1
    and discovery_run.status <> 'running_targeted_pass'
  ) then
    raise exception 'Semantic Discovery Run cannot finalize this pass.';
  end if;

  if target_pass_number = 1 then
    select count(*) into plan_segment_count
    from public.discovery_segments_v2
    where workspace_id = target_workspace_id
      and discovery_plan_id = discovery_run.discovery_plan_id;
    if expected_count <> plan_segment_count then
      raise exception
        'The initial Semantic Discovery pass must include every Plan Segment.';
    end if;
  end if;

  select count(*) into started_count
  from public.discovery_segment_runs_v2
  where workspace_id = target_workspace_id
    and discovery_run_id = target_run_id
    and pass_number = target_pass_number;
  select count(*) into matched_count
  from public.discovery_segment_runs_v2 segment_run
  join public.discovery_segments_v2 segment
    on segment.id = segment_run.discovery_segment_id
  where segment_run.id = any(canonical_expected_segment_run_ids)
    and segment_run.workspace_id = target_workspace_id
    and segment.workspace_id = target_workspace_id
    and segment_run.discovery_run_id = target_run_id
    and segment_run.pass_number = target_pass_number
    and segment.discovery_plan_id = discovery_run.discovery_plan_id;
  if started_count <> expected_count
    or matched_count <> expected_count
  then
    raise exception 'Semantic Discovery pass Segment Run membership mismatch.';
  end if;

  select count(*) into settled_count
  from public.discovery_segment_runs_v2 segment_run
  join public.discovery_coverage_snapshots_v2 coverage
    on coverage.discovery_segment_run_id = segment_run.id
  where segment_run.id = any(canonical_expected_segment_run_ids)
    and segment_run.workspace_id = target_workspace_id
    and coverage.workspace_id = target_workspace_id
    and segment_run.discovery_run_id = target_run_id
    and coverage.discovery_run_id = target_run_id
    and segment_run.pass_number = target_pass_number
    and segment_run.status in (
      'coverage_insufficient', 'coverage_sufficient',
      'exhausted', 'blocked'
    )
    and segment_run.completed_at is not null
    and coverage.settlement_hash is not null;
  if settled_count <> expected_count
  then
    raise exception 'Semantic Discovery pass is not fully settled.';
  end if;

  insert into public.discovery_pass_decisions_v2 (
    workspace_id,
    discovery_run_id,
    pass_number,
    expected_segment_run_ids,
    coverage_summary_json,
    usage_summary_json,
    decision_json,
    content_hash
  ) values (
    target_workspace_id,
    target_run_id,
    target_pass_number,
    canonical_expected_segment_run_ids,
    target_coverage_summary,
    target_usage_summary,
    target_decision,
    decision_hash
  );

  run_status := case
    when decision_kind = 'continue'
      then 'running_targeted_pass'
    when decision_kind in ('pause', 'request_user_input')
      then 'paused'
    when reason_code = 'budget_exhausted'
      then 'stopped_budget'
    when reason_code = 'user_stopped'
      then 'stopped_user'
    else 'completed'
  end;

  update public.discovery_runs_v2
  set
    status = run_status,
    coverage_summary_json = target_coverage_summary,
    usage_summary_json = target_usage_summary,
    continuation_decision_json = target_decision,
    stopping_reason = case
      when decision_kind = 'stop'
        then reason_code
      else null
    end,
    completed_at = case
      when decision_kind = 'stop' then now()
      else null
    end,
    paused_at = case when run_status = 'paused' then now() else null end
  where id = target_run_id
  returning * into discovery_run;

  if decision_kind = 'stop' then
    update public.discovery_plans_v2
    set status = 'completed'
    where id = discovery_run.discovery_plan_id
      and workspace_id = target_workspace_id;
  end if;

  return discovery_run;
end;
$$;

-- Only the worker-safe entry points may mutate runtime Semantic Discovery state.
revoke all on function public.create_discovery_plan_v2(
  uuid, uuid, uuid, uuid, jsonb, text
) from public, anon, authenticated, service_role;
revoke all on function public.start_discovery_run_v2(uuid, uuid)
from public, anon, authenticated, service_role;
revoke all on function public.start_discovery_segment_pass_v2(
  uuid, uuid, uuid, integer, uuid[]
) from public, anon, authenticated, service_role;
revoke all on function public.persist_discovery_coverage_decision_v2(
  uuid, uuid, uuid, jsonb, jsonb, jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.persist_discovery_provider_response(
  uuid, uuid, text, text, text, text, jsonb, text,
  text, text, jsonb, jsonb, text
) from public, anon, authenticated;
revoke all on function public.record_discovery_query_audit_v2(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.freeze_campaign_run_memory_snapshot_v2(
  uuid, uuid, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.load_campaign_run_memory_snapshot_v2(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.create_campaign_discovery_plan_v2(
  uuid, uuid, jsonb, text
) from public, anon, authenticated;
revoke all on function public.load_campaign_discovery_plan_v2(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.start_campaign_discovery_run_v2(
  uuid, uuid, uuid
) from public, anon, authenticated;
revoke all on function public.start_discovery_segment_pass_once_v2(
  uuid, uuid, uuid, integer, text[]
) from public, anon, authenticated;
revoke all on function public.freeze_discovery_query_plan_v2(
  uuid, uuid, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
revoke all on function public.record_discovery_query_audit_v2(
  uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.persist_discovery_segment_coverage_once_v2(
  uuid, uuid, uuid, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.finalize_discovery_pass_v2(
  uuid, uuid, integer, uuid[], jsonb, jsonb, jsonb
) from public, anon, authenticated;

-- Runtime rows remain readable through RLS, but only worker RPCs may mutate them.
revoke insert, update, delete on table
  public.campaign_memory_snapshots,
  public.memory_application_events,
  public.discovery_provider_capability_snapshots,
  public.discovery_provider_executions,
  public.provider_source_records,
  public.normalized_provider_candidates,
  public.discovery_plans_v2,
  public.discovery_segments_v2,
  public.discovery_source_plans_v2,
  public.discovery_runs_v2,
  public.discovery_segment_runs_v2,
  public.discovery_queries_v2,
  public.discovery_coverage_snapshots_v2,
  public.discovery_gaps_v2,
  public.discovery_gap_actions_v2,
  public.discovery_usage_events_v2,
  public.discovery_pass_decisions_v2,
  public.discovery_query_plans_v2
from authenticated;

grant select on table
  public.campaign_memory_snapshots,
  public.memory_application_events,
  public.discovery_provider_capability_snapshots,
  public.discovery_provider_executions,
  public.provider_source_records,
  public.normalized_provider_candidates,
  public.discovery_plans_v2,
  public.discovery_segments_v2,
  public.discovery_source_plans_v2,
  public.discovery_runs_v2,
  public.discovery_segment_runs_v2,
  public.discovery_queries_v2,
  public.discovery_coverage_snapshots_v2,
  public.discovery_gaps_v2,
  public.discovery_gap_actions_v2,
  public.discovery_usage_events_v2,
  public.discovery_pass_decisions_v2,
  public.discovery_query_plans_v2
to authenticated;

grant execute on function public.freeze_campaign_run_memory_snapshot_v2(
  uuid, uuid, uuid, jsonb, text
) to service_role;
grant execute on function public.load_campaign_run_memory_snapshot_v2(
  uuid, uuid
) to service_role;
grant execute on function public.create_campaign_discovery_plan_v2(
  uuid, uuid, jsonb, text
) to service_role;
grant execute on function public.load_campaign_discovery_plan_v2(
  uuid, uuid
) to service_role;
grant execute on function public.start_campaign_discovery_run_v2(
  uuid, uuid, uuid
) to service_role;
grant execute on function public.start_discovery_segment_pass_once_v2(
  uuid, uuid, uuid, integer, text[]
) to service_role;
grant execute on function public.freeze_discovery_query_plan_v2(
  uuid, uuid, text, text, jsonb, jsonb, text
) to service_role;
grant execute on function public.record_discovery_query_audit_v2(
  uuid, uuid, uuid, jsonb
) to service_role;
grant execute on function public.persist_discovery_segment_coverage_once_v2(
  uuid, uuid, uuid, jsonb, jsonb
) to service_role;
grant execute on function public.finalize_discovery_pass_v2(
  uuid, uuid, integer, uuid[], jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.persist_discovery_provider_response(
  uuid, uuid, text, text, text, text, jsonb, text,
  text, text, jsonb, jsonb, text
) to service_role;
