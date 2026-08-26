-- Atomically reserve exactly one continuation cycle from the latest completed decision.

create or replace function public.reserve_campaign_research_continuation_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_budget jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_cycle public.campaign_research_cycles_v2;
  previous_decision public.campaign_research_cycle_decisions_v2;
  saved_cycle public.campaign_research_cycles_v2;
  next_cycle_number integer;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then raise exception 'Forbidden';
  end if;
  if jsonb_typeof(target_budget) <> 'object' then
    raise exception 'Invalid Campaign Research continuation budget.';
  end if;
  if not exists (
    select 1 from public.campaign_runs run
    where run.id = target_campaign_run_id
      and run.workspace_id = target_workspace_id
      and run.workflow_version = 'v2'
  ) then raise exception 'V2 Campaign Run not found.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('research-continuation:' || target_campaign_run_id::text, 0)
  );
  select * into previous_cycle
  from public.campaign_research_cycles_v2 cycle
  where cycle.workspace_id = target_workspace_id
    and cycle.campaign_run_id = target_campaign_run_id
  order by cycle.cycle_number desc
  limit 1
  for update;
  if previous_cycle.status = 'running'
    and previous_cycle.continuation_of_cycle_id is not null
  then
    select * into previous_decision
    from public.campaign_research_cycle_decisions_v2 decision
    where decision.workspace_id = target_workspace_id
      and decision.research_cycle_id = previous_cycle.continuation_of_cycle_id
    order by decision.decision_number desc
    limit 1;
    if previous_cycle.budget_json <> target_budget
      or previous_decision.id is null
    then raise exception 'Existing Campaign Research continuation does not match.';
    end if;
    return jsonb_build_object(
      'id', previous_cycle.id,
      'cycleNumber', previous_cycle.cycle_number,
      'continuationOfCycleId', previous_cycle.continuation_of_cycle_id,
      'requestedAction', previous_decision.action
    );
  end if;
  if previous_cycle.id is null or previous_cycle.status <> 'complete' then
    raise exception 'The latest Campaign Research cycle is not complete.';
  end if;
  select * into previous_decision
  from public.campaign_research_cycle_decisions_v2 decision
  where decision.workspace_id = target_workspace_id
    and decision.research_cycle_id = previous_cycle.id
  order by decision.decision_number desc
  limit 1;
  if previous_decision.id is null
    or coalesce((previous_decision.decision_json->>'additionalOpportunityRemains')::boolean, false) = false
    or previous_decision.action not in (
      'research_existing_pool', 'discover_more', 'expand_source_pages', 'stop_budget'
    )
  then raise exception 'The latest decision does not justify continuation.';
  end if;

  next_cycle_number := previous_cycle.cycle_number + 1;
  insert into public.campaign_research_cycles_v2 (
    workspace_id, campaign_id, campaign_run_id, cycle_number,
    continuation_of_cycle_id, status, budget_json
  ) values (
    target_workspace_id, previous_cycle.campaign_id, target_campaign_run_id,
    next_cycle_number, previous_cycle.id, 'running', target_budget
  )
  returning * into saved_cycle;

  return jsonb_build_object(
    'id', saved_cycle.id,
    'cycleNumber', saved_cycle.cycle_number,
    'continuationOfCycleId', previous_cycle.id,
    'requestedAction', previous_decision.action
  );
end;
$$;

revoke all on function public.reserve_campaign_research_continuation_v2(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.reserve_campaign_research_continuation_v2(uuid,uuid,jsonb)
  to service_role;
