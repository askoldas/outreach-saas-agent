-- Collision-safe repair for semantic discovery persistence. Apply after 20260728001600.

create table public.discovery_plans_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete cascade,
  memory_snapshot_id uuid not null
    references public.campaign_memory_snapshots(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null check (status in (
    'draft', 'ready', 'running', 'completed', 'superseded'
  )),
  coverage_policy_json jsonb not null check (jsonb_typeof(coverage_policy_json) = 'object'),
  stopping_policy_json jsonb not null check (jsonb_typeof(stopping_policy_json) = 'object'),
  budget_policy_json jsonb not null check (jsonb_typeof(budget_policy_json) = 'object'),
  compiled_snapshot_json jsonb not null check (jsonb_typeof(compiled_snapshot_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (campaign_id, version_number),
  unique (campaign_strategy_version_id, content_hash)
);

create table public.discovery_segments_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_plan_id uuid not null references public.discovery_plans_v2(id) on delete cascade,
  segment_key text not null,
  campaign_archetype_key text not null,
  geography_json jsonb not null check (jsonb_typeof(geography_json) = 'object'),
  business_characteristics_json jsonb not null
    check (jsonb_typeof(business_characteristics_json) = 'object'),
  positive_signals_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(positive_signals_json) = 'array'),
  negative_signals_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(negative_signals_json) = 'array'),
  exclusion_rules_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(exclusion_rules_json) = 'array'),
  target_candidate_count integer check (target_candidate_count > 0),
  priority integer not null check (priority between 1 and 100),
  exploration_budget_class text not null check (
    exploration_budget_class in ('low', 'medium', 'high')
  ),
  status text not null default 'ready' check (status in (
    'draft', 'ready', 'running', 'coverage_insufficient',
    'coverage_sufficient', 'exhausted', 'blocked', 'failed'
  )),
  created_at timestamptz not null default now(),
  unique (discovery_plan_id, segment_key)
);

create table public.discovery_source_plans_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_segment_id uuid not null references public.discovery_segments_v2(id) on delete cascade,
  provider_key text not null,
  capability_snapshot_id uuid not null
    references public.discovery_provider_capability_snapshots(id) on delete cascade,
  source_role text not null check (source_role in (
    'primary', 'supporting', 'verification'
  )),
  priority integer not null check (priority > 0),
  reasons_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reasons_json) = 'array'),
  unsupported_constraints_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(unsupported_constraints_json) = 'array'),
  activation_condition_json jsonb not null default '{"type":"always"}'::jsonb
    check (jsonb_typeof(activation_condition_json) = 'object'),
  provider_request_policy_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_request_policy_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (discovery_segment_id, provider_key, source_role)
);

create or replace function public.empty_discovery_progress_counters_v2()
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'providerRecordsRetrieved', 0,
    'normalizedProviderCandidates', 0,
    'uniqueCandidateGroups', 0,
    'canonicalOrganizations', 0,
    'candidatesPrefiltered', 0,
    'candidatesResearched', 0,
    'candidatesEvaluated', 0,
    'eligibleCandidates', 0,
    'recommendedCandidates', 0,
    'conditionalCandidates', 0,
    'researchNeededCandidates', 0,
    'rejectedCandidates', 0,
    'excludedCandidates', 0,
    'invalidEntities', 0,
    'duplicatesOrMergedEntities', 0
  );
$$;

create table public.discovery_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_plan_id uuid not null references public.discovery_plans_v2(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null default 'running_initial_pass' check (status in (
    'planning', 'ready', 'running_initial_pass', 'normalizing',
    'measuring_coverage', 'gap_analysis', 'running_targeted_pass',
    'finalizing', 'completed', 'paused', 'cancelled', 'failed',
    'stopped_budget', 'stopped_user'
  )),
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  stopping_reason text,
  budget_limit_json jsonb not null check (jsonb_typeof(budget_limit_json) = 'object'),
  usage_summary_json jsonb not null default public.empty_discovery_progress_counters_v2()
    check (jsonb_typeof(usage_summary_json) = 'object'),
  coverage_summary_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(coverage_summary_json) = 'object'),
  continuation_decision_json jsonb
    check (continuation_decision_json is null or jsonb_typeof(continuation_decision_json) = 'object'),
  created_at timestamptz not null default now()
);

create table public.discovery_segment_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null references public.discovery_runs_v2(id) on delete cascade,
  discovery_segment_id uuid not null references public.discovery_segments_v2(id) on delete cascade,
  pass_number integer not null check (pass_number > 0),
  gap_ids uuid[] not null default '{}',
  status text not null default 'running' check (status in (
    'ready', 'running', 'measuring_coverage', 'coverage_insufficient',
    'coverage_sufficient', 'exhausted', 'blocked', 'failed', 'cancelled'
  )),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  provider_record_count integer not null default 0 check (provider_record_count >= 0),
  normalized_candidate_count integer not null default 0 check (normalized_candidate_count >= 0),
  unique_candidate_count integer not null default 0 check (unique_candidate_count >= 0),
  plausible_candidate_count integer check (plausible_candidate_count >= 0),
  qualified_yield_count integer check (qualified_yield_count >= 0),
  metrics_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metrics_json) = 'object'),
  unique (discovery_run_id, discovery_segment_id, pass_number)
);

alter table public.discovery_provider_executions
add column if not exists discovery_segment_run_id uuid
references public.discovery_segment_runs_v2(id) on delete cascade;

create index discovery_provider_executions_segment_run_idx_v2
on public.discovery_provider_executions(discovery_segment_run_id, started_at);

create table public.discovery_queries_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_execution_id uuid not null
    references public.discovery_provider_executions(id) on delete cascade,
  query_key text not null,
  query_text text not null,
  normalized_query text not null,
  fingerprint text not null check (length(fingerprint) = 64),
  language text not null,
  country text,
  query_type text not null,
  purpose text not null,
  sequence_number integer not null check (sequence_number > 0),
  status text not null check (status in (
    'planned', 'running', 'completed', 'failed', 'skipped_duplicate', 'skipped_budget'
  )),
  result_count integer not null default 0 check (result_count >= 0),
  created_at timestamptz not null default now(),
  unique (provider_execution_id, fingerprint)
);

create table public.discovery_coverage_snapshots_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null references public.discovery_runs_v2(id) on delete cascade,
  discovery_segment_run_id uuid not null
    references public.discovery_segment_runs_v2(id) on delete cascade,
  archetype_key text not null,
  geography_key text not null,
  metrics_json jsonb not null check (jsonb_typeof(metrics_json) = 'object'),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  status text not null check (status in (
    'not_started', 'insufficient', 'developing', 'sufficient', 'exhausted', 'blocked'
  )),
  reasons_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(reasons_json) = 'array'),
  created_at timestamptz not null default now()
);

create table public.discovery_gaps_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null references public.discovery_runs_v2(id) on delete cascade,
  discovery_segment_id uuid references public.discovery_segments_v2(id) on delete cascade,
  gap_key text not null,
  gap_type text not null check (gap_type in (
    'geography_undercovered', 'archetype_undercovered', 'language_not_attempted',
    'source_diversity_low', 'unique_yield_low', 'plausible_yield_low',
    'known_anchor_missing', 'candidate_mix_unbalanced', 'provider_failure',
    'strategy_ambiguity', 'other'
  )),
  description text not null,
  supporting_metrics_json jsonb not null
    check (jsonb_typeof(supporting_metrics_json) = 'object'),
  severity text not null check (severity in ('critical', 'high', 'normal', 'low')),
  status text not null check (status in (
    'open', 'addressing', 'resolved', 'accepted', 'blocked'
  )),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (discovery_run_id, gap_key)
);

create table public.discovery_gap_actions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_gap_id uuid not null references public.discovery_gaps_v2(id) on delete cascade,
  action_type text not null check (action_type in (
    'run_new_queries', 'translate_queries', 'activate_provider',
    'expand_directory', 'expand_from_seed', 'broaden_segment', 'narrow_segment',
    'request_user_clarification', 'stop_segment'
  )),
  reason text not null,
  expected_improvement text not null,
  max_calls integer check (max_calls > 0),
  max_estimated_cost_minor numeric check (max_estimated_cost_minor >= 0),
  status text not null default 'proposed' check (status in (
    'proposed', 'selected', 'running', 'completed', 'rejected', 'cancelled'
  )),
  created_at timestamptz not null default now()
);

create table public.discovery_usage_events_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null references public.discovery_runs_v2(id) on delete cascade,
  discovery_segment_run_id uuid references public.discovery_segment_runs_v2(id) on delete cascade,
  provider_execution_id uuid
    references public.discovery_provider_executions(id) on delete cascade,
  event_type text not null,
  metrics_json jsonb not null check (jsonb_typeof(metrics_json) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function public.validate_discovery_v2_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name = 'discovery_plans_v2' then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.campaign_id;
    if not exists (
      select 1 from public.campaign_strategy_versions
      where id = new.campaign_strategy_version_id and campaign_id = new.campaign_id
        and workspace_id = new.workspace_id and confirmation_status = 'confirmed'
    ) then raise exception 'Discovery Strategy version mismatch.'; end if;
    if not exists (
      select 1 from public.campaign_memory_snapshots
      where id = new.memory_snapshot_id and campaign_id = new.campaign_id
        and workspace_id = new.workspace_id
        and campaign_strategy_version_id = new.campaign_strategy_version_id
    ) then raise exception 'Discovery Memory snapshot mismatch.'; end if;
  elsif tg_table_name in ('discovery_segments_v2') then
    select workspace_id into expected_workspace_id from public.discovery_plans_v2
    where id = new.discovery_plan_id;
  elsif tg_table_name = 'discovery_source_plans_v2' then
    select workspace_id into expected_workspace_id from public.discovery_segments_v2
    where id = new.discovery_segment_id;
    if not exists (
      select 1 from public.discovery_provider_capability_snapshots
      where id = new.capability_snapshot_id and workspace_id = new.workspace_id
        and provider_key = new.provider_key
    ) then raise exception 'Discovery route capability snapshot mismatch.'; end if;
  elsif tg_table_name = 'discovery_runs_v2' then
    select workspace_id into expected_workspace_id from public.discovery_plans_v2
    where id = new.discovery_plan_id and campaign_id = new.campaign_id;
  elsif tg_table_name = 'discovery_segment_runs_v2' then
    select run.workspace_id into expected_workspace_id
    from public.discovery_runs_v2 run
    join public.discovery_segments_v2 segment on segment.id = new.discovery_segment_id
    where run.id = new.discovery_run_id
      and segment.discovery_plan_id = run.discovery_plan_id;
  elsif tg_table_name = 'discovery_queries_v2' then
    select workspace_id into expected_workspace_id from public.discovery_provider_executions
    where id = new.provider_execution_id;
  elsif tg_table_name = 'discovery_coverage_snapshots_v2' then
    select workspace_id into expected_workspace_id from public.discovery_segment_runs_v2
    where id = new.discovery_segment_run_id and discovery_run_id = new.discovery_run_id;
  elsif tg_table_name = 'discovery_gaps_v2' then
    select workspace_id into expected_workspace_id from public.discovery_runs_v2
    where id = new.discovery_run_id;
  elsif tg_table_name = 'discovery_gap_actions_v2' then
    select workspace_id into expected_workspace_id from public.discovery_gaps_v2
    where id = new.discovery_gap_id;
  elsif tg_table_name = 'discovery_usage_events_v2' then
    select workspace_id into expected_workspace_id from public.discovery_runs_v2
    where id = new.discovery_run_id;
  else return new;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Semantic Discovery association.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_provider_segment_run()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.discovery_segment_run_id is null then return new; end if;
  if not exists (
    select 1
    from public.discovery_segment_runs_v2 segment_run
    join public.discovery_segments_v2 segment on segment.id = segment_run.discovery_segment_id
    join public.discovery_runs_v2 run on run.id = segment_run.discovery_run_id
    where segment_run.id = new.discovery_segment_run_id
      and segment_run.workspace_id = new.workspace_id
      and run.campaign_id = new.campaign_id
      and segment.segment_key = new.discovery_segment_key
  ) then raise exception 'Provider execution does not belong to its Segment Run.'; end if;
  return new;
end;
$$;
create trigger discovery_provider_executions_segment_run_guard
before insert or update of discovery_segment_run_id
on public.discovery_provider_executions
for each row execute function public.validate_provider_segment_run();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'discovery_plans_v2', 'discovery_segments_v2', 'discovery_source_plans_v2',
    'discovery_runs_v2', 'discovery_segment_runs_v2', 'discovery_queries_v2',
    'discovery_coverage_snapshots_v2', 'discovery_gaps_v2', 'discovery_gap_actions_v2',
    'discovery_usage_events_v2'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_discovery_v2_workspace()',
      table_name || '_workspace_guard', table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      'Admins can manage ' || table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.create_discovery_plan_v2(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_strategy_version_id uuid,
  target_memory_snapshot_id uuid,
  target_plan jsonb,
  target_content_hash text
)
returns public.discovery_plans_v2
language plpgsql security definer set search_path = public as $$
declare saved_plan public.discovery_plans_v2;
declare segment jsonb;
declare route jsonb;
declare provider jsonb;
declare capability_entry jsonb;
declare capability_snapshot_id uuid;
declare saved_segment public.discovery_segments_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if target_plan->>'campaignId' <> target_campaign_id::text
    or target_plan->>'campaignStrategyVersionId' <> target_strategy_version_id::text
    or target_plan->>'memorySnapshotId' <> target_memory_snapshot_id::text
    or target_plan->>'contentHash' <> target_content_hash
  then raise exception 'Discovery Plan identity or content hash mismatch.'; end if;
  insert into public.discovery_plans_v2 (
    workspace_id, campaign_id, campaign_strategy_version_id, memory_snapshot_id,
    version_number, status, coverage_policy_json, stopping_policy_json,
    budget_policy_json, compiled_snapshot_json, content_hash
  ) values (
    target_workspace_id, target_campaign_id, target_strategy_version_id,
    target_memory_snapshot_id, (target_plan->>'versionNumber')::integer, 'ready',
    target_plan->'coveragePolicy', target_plan->'stoppingPolicy',
    target_plan->'budgetPolicy', target_plan, target_content_hash
  )
  on conflict (campaign_strategy_version_id, content_hash)
  do update set content_hash = public.discovery_plans_v2.content_hash
  returning * into saved_plan;
  for capability_entry in
    select * from jsonb_array_elements(target_plan->'providerCapabilities')
  loop
    insert into public.discovery_provider_capability_snapshots (
      workspace_id, provider_key, adapter_version, capabilities_json, content_hash
    ) values (
      target_workspace_id, capability_entry->>'providerId',
      capability_entry->>'providerVersion', capability_entry->'capabilities',
      capability_entry->>'contentHash'
    ) on conflict (workspace_id, provider_key, adapter_version, content_hash)
    do nothing;
  end loop;
  for segment in select * from jsonb_array_elements(target_plan->'segments') loop
    insert into public.discovery_segments_v2 (
      workspace_id, discovery_plan_id, segment_key, campaign_archetype_key,
      geography_json, business_characteristics_json, positive_signals_json,
      negative_signals_json, exclusion_rules_json, target_candidate_count,
      priority, exploration_budget_class, status
    ) values (
      target_workspace_id, saved_plan.id, segment->>'id', segment->>'archetypeId',
      segment->'geography', segment->'businessCharacteristics',
      segment->'positiveSignals', segment->'negativeSignals',
      segment->'exclusionRules', (segment->>'targetCandidateCount')::integer,
      (segment->>'priority')::integer, segment->>'explorationBudgetClass', 'ready'
    )
    on conflict (discovery_plan_id, segment_key) do nothing
    returning * into saved_segment;
    if saved_segment.id is null then
      select * into saved_segment from public.discovery_segments_v2
      where discovery_plan_id = saved_plan.id and segment_key = segment->>'id';
    end if;
    select value into route from jsonb_array_elements(target_plan->'routes')
    where value->>'segmentId' = segment->>'id';
    if route is null then raise exception 'Semantic segment has no provider route.'; end if;
    for provider in select * from jsonb_array_elements(route->'providers') loop
      select snapshot.id into capability_snapshot_id
      from public.discovery_provider_capability_snapshots snapshot
      join lateral jsonb_array_elements(target_plan->'providerCapabilities')
        as frozen(value)
        on frozen.value->>'providerId' = snapshot.provider_key
        and frozen.value->>'providerVersion' = snapshot.adapter_version
        and frozen.value->>'contentHash' = snapshot.content_hash
      where snapshot.workspace_id = target_workspace_id
        and snapshot.provider_key = provider->>'providerId';
      if capability_snapshot_id is null then
        raise exception 'Routed provider has no frozen capability snapshot.';
      end if;
      insert into public.discovery_source_plans_v2 (
        workspace_id, discovery_segment_id, provider_key, capability_snapshot_id, source_role,
        priority, reasons_json, unsupported_constraints_json
      ) values (
        target_workspace_id, saved_segment.id, provider->>'providerId',
        capability_snapshot_id, provider->>'role', (provider->>'priority')::integer,
        provider->'reasons', provider->'unsupportedConstraints'
      ) on conflict (discovery_segment_id, provider_key, source_role) do nothing;
      capability_snapshot_id := null;
    end loop;
    saved_segment := null;
    route := null;
  end loop;
  return saved_plan;
end;
$$;

create or replace function public.start_discovery_run_v2(
  target_workspace_id uuid,
  target_plan_id uuid
)
returns public.discovery_runs_v2
language plpgsql security definer set search_path = public as $$
declare plan public.discovery_plans_v2;
declare saved_run public.discovery_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into plan from public.discovery_plans_v2
  where id = target_plan_id and workspace_id = target_workspace_id
    and status = 'ready' for update;
  if plan.id is null then raise exception 'Ready Discovery Plan not found.'; end if;
  insert into public.discovery_runs_v2 (
    workspace_id, discovery_plan_id, campaign_id, status, budget_limit_json
  ) values (
    target_workspace_id, plan.id, plan.campaign_id,
    'running_initial_pass', plan.budget_policy_json
  ) returning * into saved_run;
  update public.discovery_plans_v2 set status = 'running' where id = plan.id;
  return saved_run;
end;
$$;

create or replace function public.persist_discovery_coverage_decision_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_segment_run_id uuid,
  target_coverage jsonb,
  target_gaps jsonb,
  target_decision jsonb
)
returns public.discovery_coverage_snapshots_v2
language plpgsql security definer set search_path = public as $$
declare saved_snapshot public.discovery_coverage_snapshots_v2;
declare gap jsonb;
declare action jsonb;
declare saved_gap public.discovery_gaps_v2;
declare run_status text;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  insert into public.discovery_coverage_snapshots_v2 (
    workspace_id, discovery_run_id, discovery_segment_run_id,
    archetype_key, geography_key, metrics_json, confidence, status, reasons_json
  ) values (
    target_workspace_id, target_run_id, target_segment_run_id,
    target_coverage->>'archetypeId', target_coverage->>'geographyKey',
    target_coverage, (target_coverage->>'confidence')::numeric,
    target_coverage->>'status', target_coverage->'reasons'
  ) returning * into saved_snapshot;
  for gap in select * from jsonb_array_elements(target_gaps) loop
    insert into public.discovery_gaps_v2 (
      workspace_id, discovery_run_id, discovery_segment_id, gap_key,
      gap_type, description, supporting_metrics_json, severity, status
    )
    select
      target_workspace_id, target_run_id, segment_run.discovery_segment_id,
      gap->>'id', gap->>'type', gap->>'description',
      gap->'supportingMetrics', gap->>'severity', gap->>'status'
    from public.discovery_segment_runs_v2 segment_run
    where segment_run.id = target_segment_run_id
    on conflict (discovery_run_id, gap_key) do update set
      supporting_metrics_json = excluded.supporting_metrics_json,
      severity = excluded.severity, status = excluded.status
    returning * into saved_gap;
    for action in select * from jsonb_array_elements(gap->'recommendedActions') loop
      insert into public.discovery_gap_actions_v2 (
        workspace_id, discovery_gap_id, action_type, reason,
        expected_improvement, max_calls, max_estimated_cost_minor
      ) values (
        target_workspace_id, saved_gap.id, action->>'type', action->>'reason',
        action->>'expectedImprovement', (action->>'maxCalls')::integer,
        (action->>'maxEstimatedCostMinor')::numeric
      );
    end loop;
  end loop;
  update public.discovery_segment_runs_v2 set
    status = case target_coverage->>'status'
      when 'sufficient' then 'coverage_sufficient'
      when 'exhausted' then 'exhausted'
      when 'blocked' then 'blocked'
      else 'coverage_insufficient'
    end,
    completed_at = now(), metrics_json = target_coverage,
    provider_record_count = (target_coverage->>'rawRecords')::integer,
    normalized_candidate_count = (target_coverage->>'normalizedCandidates')::integer,
    unique_candidate_count = (target_coverage->>'uniqueCandidateHints')::integer
  where id = target_segment_run_id and discovery_run_id = target_run_id;
  update public.discovery_segments_v2 set status =
    case target_coverage->>'status'
      when 'sufficient' then 'coverage_sufficient'
      when 'exhausted' then 'exhausted'
      when 'blocked' then 'blocked'
      else 'coverage_insufficient'
    end
  where id = (
    select discovery_segment_id from public.discovery_segment_runs_v2
    where id = target_segment_run_id
  );
  run_status := case
    when target_decision->>'reasonCode' = 'budget_exhausted' then 'stopped_budget'
    when target_decision->>'reasonCode' = 'user_stopped' then 'stopped_user'
    else case target_decision->>'decision'
    when 'continue' then 'running_targeted_pass'
    when 'pause' then 'paused'
    when 'request_user_input' then 'paused'
    else 'completed'
    end
  end;
  update public.discovery_runs_v2 set
    status = run_status,
    continuation_decision_json = target_decision,
    stopping_reason = case when target_decision->>'decision' = 'stop'
      then target_decision->>'reasonCode' else null end,
    completed_at = case when target_decision->>'decision' = 'stop' then now() else null end,
    paused_at = case when run_status = 'paused' then now() else null end
  where id = target_run_id and workspace_id = target_workspace_id;
  return saved_snapshot;
end;
$$;

create or replace function public.start_discovery_segment_pass_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_segment_id uuid,
  target_pass_number integer,
  target_gap_ids uuid[] default '{}'
)
returns public.discovery_segment_runs_v2
language plpgsql security definer set search_path = public as $$
declare saved public.discovery_segment_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  insert into public.discovery_segment_runs_v2 (
    workspace_id, discovery_run_id, discovery_segment_id,
    pass_number, gap_ids, status
  ) values (
    target_workspace_id, target_run_id, target_segment_id,
    target_pass_number, target_gap_ids, 'running'
  )
  on conflict (discovery_run_id, discovery_segment_id, pass_number)
  do update set pass_number = public.discovery_segment_runs_v2.pass_number
  returning * into saved;
  update public.discovery_segments_v2 set status = 'running' where id = target_segment_id;
  return saved;
end;
$$;

create or replace function public.record_discovery_query_audit_v2(
  target_workspace_id uuid,
  target_provider_execution_id uuid,
  target_segment_run_id uuid,
  target_queries jsonb
)
returns integer
language plpgsql security definer set search_path = public as $$
declare query_record jsonb;
declare inserted_count integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  update public.discovery_provider_executions
  set discovery_segment_run_id = target_segment_run_id
  where id = target_provider_execution_id and workspace_id = target_workspace_id;
  if not found then raise exception 'Provider execution not found.'; end if;
  for query_record in select * from jsonb_array_elements(target_queries) loop
    insert into public.discovery_queries_v2 (
      workspace_id, provider_execution_id, query_key, query_text,
      normalized_query, fingerprint, language, country, query_type,
      purpose, sequence_number, status, result_count
    ) values (
      target_workspace_id, target_provider_execution_id, query_record->>'id',
      query_record->>'query', query_record->>'normalizedQuery',
      query_record->>'fingerprint', query_record->>'language',
      query_record->>'country', query_record->>'family',
      query_record->>'purpose', (query_record->>'priority')::integer,
      coalesce(query_record->>'status', 'completed'),
      coalesce((query_record->>'resultCount')::integer, 0)
    ) on conflict (provider_execution_id, fingerprint) do nothing;
    if found then inserted_count := inserted_count + 1; end if;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.create_discovery_plan_v2(uuid,uuid,uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.start_discovery_run_v2(uuid,uuid) from public, anon;
revoke all on function public.persist_discovery_coverage_decision_v2(uuid,uuid,uuid,jsonb,jsonb,jsonb) from public, anon;
revoke all on function public.start_discovery_segment_pass_v2(uuid,uuid,uuid,integer,uuid[]) from public, anon;
revoke all on function public.record_discovery_query_audit_v2(uuid,uuid,uuid,jsonb) from public, anon;
grant execute on function public.create_discovery_plan_v2(uuid,uuid,uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.start_discovery_run_v2(uuid,uuid) to authenticated, service_role;
grant execute on function public.persist_discovery_coverage_decision_v2(uuid,uuid,uuid,jsonb,jsonb,jsonb) to authenticated, service_role;
grant execute on function public.start_discovery_segment_pass_v2(uuid,uuid,uuid,integer,uuid[]) to authenticated, service_role;
grant execute on function public.record_discovery_query_audit_v2(uuid,uuid,uuid,jsonb) to authenticated, service_role;

