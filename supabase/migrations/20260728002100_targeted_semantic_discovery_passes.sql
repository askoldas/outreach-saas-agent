-- Durable, retry-safe targeted Semantic Discovery passes.
-- Apply after 20260728002000_retry_safe_semantic_discovery.sql.

create table public.discovery_gap_action_executions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_run_id uuid not null
    references public.discovery_runs_v2(id) on delete cascade,
  discovery_segment_run_id uuid not null
    references public.discovery_segment_runs_v2(id) on delete cascade,
  discovery_gap_id uuid not null
    references public.discovery_gaps_v2(id) on delete cascade,
  discovery_gap_action_id uuid not null
    references public.discovery_gap_actions_v2(id) on delete cascade,
  pass_number integer not null check (pass_number > 1),
  allocated_calls integer not null check (allocated_calls > 0),
  status text not null default 'running'
    check (status in ('selected', 'running', 'completed', 'failed', 'cancelled')),
  action_plan_json jsonb not null check (jsonb_typeof(action_plan_json) = 'object'),
  action_plan_hash text not null check (length(action_plan_hash) = 64),
  outcome_json jsonb check (
    outcome_json is null or jsonb_typeof(outcome_json) = 'object'
  ),
  outcome_hash text check (outcome_hash is null or length(outcome_hash) = 64),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (discovery_segment_run_id, discovery_gap_action_id)
);

create index discovery_gap_action_executions_v2_run_pass_idx
on public.discovery_gap_action_executions_v2(
  discovery_run_id,
  pass_number,
  discovery_segment_run_id
);

create or replace function public.validate_discovery_gap_action_execution_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.discovery_segment_runs_v2 segment_run
    join public.discovery_gaps_v2 gap
      on gap.id = new.discovery_gap_id
      and gap.discovery_run_id = segment_run.discovery_run_id
      and (
        gap.discovery_segment_id is null
        or gap.discovery_segment_id = segment_run.discovery_segment_id
      )
    join public.discovery_gap_actions_v2 gap_action
      on gap_action.id = new.discovery_gap_action_id
      and gap_action.discovery_gap_id = gap.id
    where segment_run.id = new.discovery_segment_run_id
      and segment_run.workspace_id = new.workspace_id
      and segment_run.discovery_run_id = new.discovery_run_id
      and segment_run.pass_number = new.pass_number
      and segment_run.pass_number > 1
  ) then
    raise exception 'Targeted Discovery action execution association mismatch.';
  end if;
  return new;
end;
$$;

create trigger discovery_gap_action_executions_v2_workspace_guard
before insert or update
on public.discovery_gap_action_executions_v2
for each row execute function public.validate_discovery_gap_action_execution_v2();

alter table public.discovery_gap_action_executions_v2 enable row level security;

create policy "Members can read discovery_gap_action_executions_v2"
on public.discovery_gap_action_executions_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

grant select on public.discovery_gap_action_executions_v2 to authenticated;

create or replace function public.start_targeted_discovery_pass_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_pass_number integer,
  target_batches jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  discovery_run public.discovery_runs_v2;
  prior_decision public.discovery_pass_decisions_v2;
  batch jsonb;
  action_plan jsonb;
  segment_run public.discovery_segment_runs_v2;
  gap_record public.discovery_gaps_v2;
  gap_action public.discovery_gap_actions_v2;
  action_execution public.discovery_gap_action_executions_v2;
  gap_keys text[];
  batch_segment_id uuid;
  action_count integer;
  selected_action_count integer;
  allocated_calls integer;
  maximum_provider_calls integer;
  consumed_provider_calls integer;
  action_plan_hash text;
  results jsonb := '[]'::jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_pass_number is null or target_pass_number <= 1 then
    raise exception 'A targeted Semantic Discovery pass number must be greater than one.';
  end if;
  if jsonb_typeof(target_batches) is distinct from 'array'
    or jsonb_array_length(target_batches) = 0
  then
    raise exception 'A targeted Semantic Discovery pass requires action batches.';
  end if;

  select * into discovery_run
  from public.discovery_runs_v2
  where id = target_run_id
    and workspace_id = target_workspace_id
  for update;
  if discovery_run.id is null then
    raise exception 'Semantic Discovery Run not found.';
  end if;
  if discovery_run.status <> 'running_targeted_pass' then
    raise exception 'Semantic Discovery Run cannot start a targeted pass.';
  end if;

  select * into prior_decision
  from public.discovery_pass_decisions_v2
  where discovery_run_id = target_run_id
    and pass_number = target_pass_number - 1
    and decision_json->>'decision' = 'continue'
  for update;
  if prior_decision.id is null then
    raise exception 'Targeted Discovery requires a prior continuation decision.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_batches) incoming_batch
    where jsonb_typeof(incoming_batch) is distinct from 'object'
      or nullif(incoming_batch->>'segmentId', '') is null
      or jsonb_typeof(incoming_batch->'actions') is distinct from 'array'
      or jsonb_array_length(incoming_batch->'actions') = 0
  ) then
    raise exception 'Targeted Discovery action batch is invalid.';
  end if;
  if jsonb_array_length(target_batches) <> (
    select count(distinct incoming_batch->>'segmentId')
    from jsonb_array_elements(target_batches) incoming_batch
  ) then
    raise exception 'Targeted Discovery Segment batches must be unique.';
  end if;

  select count(*), coalesce(sum((action->>'maxCalls')::integer), 0)
  into action_count, allocated_calls
  from jsonb_array_elements(target_batches) incoming_batch
  cross join jsonb_array_elements(incoming_batch->'actions') action;
  if action_count = 0
    or allocated_calls <= 0
    or exists (
      select 1
      from jsonb_array_elements(target_batches) incoming_batch
      cross join jsonb_array_elements(incoming_batch->'actions') action
      where jsonb_typeof(action) is distinct from 'object'
        or nullif(action->>'gapId', '') is null
        or nullif(action->>'type', '') is null
        or nullif(btrim(action->>'reason'), '') is null
        or nullif(btrim(action->>'expectedImprovement'), '') is null
        or coalesce((action->>'maxCalls')::integer, 0) <= 0
    )
  then
    raise exception 'Targeted Discovery action plan is incomplete.';
  end if;
  if action_count <> (
    select count(distinct action::text)
    from jsonb_array_elements(target_batches) incoming_batch
    cross join jsonb_array_elements(incoming_batch->'actions') action
  ) then
    raise exception 'Targeted Discovery action plans must be unique.';
  end if;

  if jsonb_typeof(prior_decision.decision_json->'selectedActionPlans') = 'array'
    and jsonb_array_length(
      prior_decision.decision_json->'selectedActionPlans'
    ) > 0
  then
    selected_action_count := jsonb_array_length(
      prior_decision.decision_json->'selectedActionPlans'
    );
    if selected_action_count <> action_count
      or exists (
        select 1
        from jsonb_array_elements(target_batches) incoming_batch
        cross join jsonb_array_elements(incoming_batch->'actions') action
        where not exists (
          select 1
          from jsonb_array_elements(
            prior_decision.decision_json->'selectedActionPlans'
          ) selected_action
          where selected_action = action
        )
      )
    then
      raise exception 'Targeted Discovery actions changed after pass finalization.';
    end if;
  elsif exists (
    select 1
    from jsonb_array_elements(target_batches) incoming_batch
    cross join jsonb_array_elements(incoming_batch->'actions') action
    where not (
      prior_decision.decision_json->'selectedGapIds' ? (action->>'gapId')
    ) or not (
      prior_decision.decision_json->'selectedActions' ? (action->>'type')
    )
  ) then
    raise exception 'Targeted Discovery action is not present in the prior decision.';
  end if;

  maximum_provider_calls := coalesce(
    (discovery_run.budget_limit_json->>'maximumProviderCalls')::integer,
    0
  );
  consumed_provider_calls := coalesce(
    (discovery_run.usage_summary_json->>'providerCalls')::integer,
    0
  );
  if maximum_provider_calls <= 0
    or allocated_calls > greatest(
      0,
      maximum_provider_calls - consumed_provider_calls
    )
  then
    raise exception 'Targeted Discovery action allocation exceeds the remaining call budget.';
  end if;

  for batch in select * from jsonb_array_elements(target_batches) loop
    batch_segment_id := (batch->>'segmentId')::uuid;
    if not exists (
      select 1
      from public.discovery_segments_v2 segment
      where segment.id = batch_segment_id
        and segment.workspace_id = target_workspace_id
        and segment.discovery_plan_id = discovery_run.discovery_plan_id
    ) then
      raise exception 'Targeted Discovery Segment does not belong to the Run.';
    end if;

    select array_agg(distinct action->>'gapId' order by action->>'gapId')
    into gap_keys
    from jsonb_array_elements(batch->'actions') action;

    select * into segment_run
    from public.start_discovery_segment_pass_once_v2(
      target_workspace_id,
      target_run_id,
      batch_segment_id,
      target_pass_number,
      gap_keys
    );

    for action_plan in select * from jsonb_array_elements(batch->'actions') loop
      select * into gap_record
      from public.discovery_gaps_v2 gap
      where gap.workspace_id = target_workspace_id
        and gap.discovery_run_id = target_run_id
        and gap.gap_key = action_plan->>'gapId'
        and gap.status in ('open', 'addressing')
        and (
          gap.discovery_segment_id is null
          or gap.discovery_segment_id = batch_segment_id
        )
      for update;
      if gap_record.id is null then
        raise exception 'Targeted Discovery gap is unavailable.';
      end if;

      select * into gap_action
      from public.discovery_gap_actions_v2 candidate_action
      where candidate_action.workspace_id = target_workspace_id
        and candidate_action.discovery_gap_id = gap_record.id
        and candidate_action.action_type = action_plan->>'type'
        and candidate_action.reason = action_plan->>'reason'
        and candidate_action.expected_improvement =
          action_plan->>'expectedImprovement'
        and coalesce(candidate_action.max_calls, 1) =
          (action_plan->>'maxCalls')::integer
        and candidate_action.max_estimated_cost_minor is not distinct from
          nullif(action_plan->>'maxEstimatedCostMinor', '')::numeric
      order by candidate_action.created_at, candidate_action.id
      limit 1
      for update;
      if gap_action.id is null then
        raise exception 'Targeted Discovery gap action is unavailable.';
      end if;

      action_plan_hash := encode(digest(action_plan::text, 'sha256'), 'hex');
      select * into action_execution
      from public.discovery_gap_action_executions_v2
      where discovery_segment_run_id = segment_run.id
        and discovery_gap_action_id = gap_action.id
      for update;
      if action_execution.id is null then
        insert into public.discovery_gap_action_executions_v2 (
          workspace_id,
          discovery_run_id,
          discovery_segment_run_id,
          discovery_gap_id,
          discovery_gap_action_id,
          pass_number,
          allocated_calls,
          status,
          action_plan_json,
          action_plan_hash
        ) values (
          target_workspace_id,
          target_run_id,
          segment_run.id,
          gap_record.id,
          gap_action.id,
          target_pass_number,
          (action_plan->>'maxCalls')::integer,
          'running',
          action_plan,
          action_plan_hash
        );
      elsif action_execution.action_plan_hash <> action_plan_hash
        or action_execution.action_plan_json <> action_plan
        or action_execution.allocated_calls <>
          (action_plan->>'maxCalls')::integer
      then
        raise exception 'Targeted Discovery action retry changed frozen work.';
      end if;

      update public.discovery_gaps_v2
      set status = 'addressing', resolved_at = null
      where id = gap_record.id;
      update public.discovery_gap_actions_v2
      set status = case
        when status = 'completed' then status
        else 'running'
      end
      where id = gap_action.id;
      gap_record := null;
      gap_action := null;
      action_execution := null;
    end loop;

    results := results || jsonb_build_array(
      jsonb_build_object(
        'segmentId', batch_segment_id,
        'segmentRunId', segment_run.id,
        'allocatedCalls', (
          select sum((action->>'maxCalls')::integer)
          from jsonb_array_elements(batch->'actions') action
        )
      )
    );
    segment_run := null;
  end loop;

  return results;
end;
$$;

create or replace function public.complete_targeted_discovery_segment_pass_v2(
  target_workspace_id uuid,
  target_segment_run_id uuid,
  target_outcome jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  segment_run public.discovery_segment_runs_v2;
  action_execution public.discovery_gap_action_executions_v2;
  target_outcome_hash text;
  remaining_gap_ids jsonb;
  completed_count integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if jsonb_typeof(target_outcome) is distinct from 'object'
    or jsonb_typeof(target_outcome->'remainingGapIds') is distinct from 'array'
    or jsonb_typeof(target_outcome->'executionIds') is distinct from 'array'
    or coalesce((target_outcome->>'providerCalls')::integer, -1) < 0
  then
    raise exception 'Targeted Discovery outcome is invalid.';
  end if;

  select * into segment_run
  from public.discovery_segment_runs_v2
  where id = target_segment_run_id
    and workspace_id = target_workspace_id
    and pass_number > 1
  for update;
  if segment_run.id is null then
    raise exception 'Targeted Discovery Segment Run not found.';
  end if;
  if not exists (
    select 1
    from public.discovery_coverage_snapshots_v2 coverage
    where coverage.discovery_segment_run_id = segment_run.id
      and coverage.workspace_id = target_workspace_id
      and coverage.settlement_hash is not null
  ) then
    raise exception 'Targeted Discovery Segment coverage is not settled.';
  end if;

  target_outcome_hash := encode(digest(target_outcome::text, 'sha256'), 'hex');
  remaining_gap_ids := target_outcome->'remainingGapIds';

  for action_execution in
    select *
    from public.discovery_gap_action_executions_v2
    where discovery_segment_run_id = segment_run.id
      and workspace_id = target_workspace_id
    order by id
    for update
  loop
    if action_execution.status = 'completed' then
      if action_execution.outcome_hash <> target_outcome_hash
        or action_execution.outcome_json <> target_outcome
      then
        raise exception 'Targeted Discovery outcome retry changed settled work.';
      end if;
    elsif action_execution.status = 'running' then
      update public.discovery_gap_action_executions_v2
      set
        status = 'completed',
        outcome_json = target_outcome,
        outcome_hash = target_outcome_hash,
        completed_at = now()
      where id = action_execution.id;
    else
      raise exception 'Targeted Discovery action is not completable.';
    end if;

    update public.discovery_gap_actions_v2
    set status = 'completed'
    where id = action_execution.discovery_gap_action_id;

    if exists (
      select 1
      from public.discovery_gaps_v2 gap
      where gap.id = action_execution.discovery_gap_id
        and remaining_gap_ids ? gap.gap_key
    ) then
      update public.discovery_gaps_v2
      set status = 'open', resolved_at = null
      where id = action_execution.discovery_gap_id;
    else
      update public.discovery_gaps_v2
      set status = 'resolved', resolved_at = now()
      where id = action_execution.discovery_gap_id;
    end if;
    completed_count := completed_count + 1;
  end loop;

  if completed_count = 0 then
    raise exception 'Targeted Discovery Segment has no frozen gap actions.';
  end if;

  update public.discovery_gaps_v2
  set status = 'resolved', resolved_at = now()
  where workspace_id = target_workspace_id
    and discovery_run_id = segment_run.discovery_run_id
    and discovery_segment_id = segment_run.discovery_segment_id
    and status in ('open', 'addressing')
    and not (remaining_gap_ids ? gap_key);
  update public.discovery_gaps_v2
  set status = 'open', resolved_at = null
  where workspace_id = target_workspace_id
    and discovery_run_id = segment_run.discovery_run_id
    and discovery_segment_id = segment_run.discovery_segment_id
    and remaining_gap_ids ? gap_key;

  return jsonb_build_object(
    'segmentRunId', segment_run.id,
    'completedActionCount', completed_count,
    'outcomeHash', target_outcome_hash
  );
end;
$$;

create or replace function public.finalize_targeted_discovery_pass_v2(
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
  saved_run public.discovery_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_pass_number is null or target_pass_number <= 1 then
    raise exception 'Targeted Discovery finalization requires pass number greater than one.';
  end if;
  if target_expected_segment_run_ids is null
    or cardinality(target_expected_segment_run_ids) = 0
  then
    raise exception 'Targeted Discovery finalization requires Segment Runs.';
  end if;
  if exists (
    select 1
    from unnest(target_expected_segment_run_ids) expected(segment_run_id)
    where not exists (
      select 1
      from public.discovery_gap_action_executions_v2 action_execution
      where action_execution.workspace_id = target_workspace_id
        and action_execution.discovery_run_id = target_run_id
        and action_execution.discovery_segment_run_id = expected.segment_run_id
        and action_execution.pass_number = target_pass_number
        and action_execution.status = 'completed'
        and action_execution.completed_at is not null
        and action_execution.outcome_hash is not null
    )
  ) or exists (
    select 1
    from public.discovery_gap_action_executions_v2 action_execution
    where action_execution.workspace_id = target_workspace_id
      and action_execution.discovery_run_id = target_run_id
      and action_execution.discovery_segment_run_id =
        any(target_expected_segment_run_ids)
      and action_execution.pass_number = target_pass_number
      and action_execution.status <> 'completed'
  ) then
    raise exception 'Targeted Discovery actions are not fully settled.';
  end if;

  select * into saved_run
  from public.finalize_discovery_pass_v2(
    target_workspace_id,
    target_run_id,
    target_pass_number,
    target_expected_segment_run_ids,
    target_coverage_summary,
    target_usage_summary,
    target_decision
  );
  return saved_run;
end;
$$;

revoke all on table public.discovery_gap_action_executions_v2
from anon, authenticated;
grant select on table public.discovery_gap_action_executions_v2
to authenticated;

revoke all on function public.start_targeted_discovery_pass_v2(
  uuid, uuid, integer, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_targeted_discovery_segment_pass_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.finalize_targeted_discovery_pass_v2(
  uuid, uuid, integer, uuid[], jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.start_targeted_discovery_pass_v2(
  uuid, uuid, integer, jsonb
) to service_role;
grant execute on function public.complete_targeted_discovery_segment_pass_v2(
  uuid, uuid, jsonb
) to service_role;
grant execute on function public.finalize_targeted_discovery_pass_v2(
  uuid, uuid, integer, uuid[], jsonb, jsonb, jsonb
) to service_role;
