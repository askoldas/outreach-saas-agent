-- Increase an outcome target and reopen the same durable run without discarding work.
create or replace function public.increase_company_research_target(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_quote jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare workflow public.intelligence_workflow_runs;
declare previous_cycle public.campaign_research_cycles_v2;
declare saved_cycle public.campaign_research_cycles_v2;
declare requested_count integer;
declare quoted_credits numeric(18, 6);
declare incremental_credits numeric(18, 6);
declare requested_action text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if jsonb_typeof(target_quote) <> 'object'
    or target_quote->>'pricingBasis' <> 'requested_qualified_companies'
    or (target_quote->>'schemaVersion')::integer <> 1
  then raise exception 'Invalid Company Research target quote.'; end if;
  requested_count := (target_quote->>'requestedCompanyCount')::integer;
  quoted_credits := (target_quote->>'authorizedCredits')::numeric;
  if requested_count is null or requested_count < 1 or requested_count > 500
    or quoted_credits is null or quoted_credits <= 0
  then raise exception 'Invalid Company Research target revision.'; end if;

  perform pg_advisory_xact_lock(hashtextextended('research-outcome:' || target_campaign_run_id::text, 0));
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  if target_run.id is null or target_run.workflow_version <> 'v2'
  then raise exception 'V2 Campaign Run not found.'; end if;
  requested_action := case when exists (
    select 1 from public.candidate_qualification_batch_members_v2 member
    join public.candidate_qualification_batches_v2 batch
      on batch.id = member.candidate_qualification_batch_id
    where batch.campaign_run_id = target_run.id and member.status = 'queued'
  ) then 'research_existing_pool' else 'discover_more' end;

  if requested_count = target_run.requested_company_count
    and exists (select 1 from public.campaign_run_target_revisions revision
      where revision.campaign_run_id = target_run.id
        and revision.requested_company_count = requested_count)
  then
    requested_action := coalesce((select event.details->>'requestedAction'
      from public.campaign_run_events event
      where event.campaign_run_id = target_run.id
        and event.event_type = 'research_target_increased'
        and (event.details->>'requestedCompanyCount')::integer = requested_count
      order by event.created_at desc limit 1), requested_action);
    incremental_credits := coalesce((select
        (event.details->>'incrementalAuthorizedCredits')::numeric
      from public.campaign_run_events event
      where event.campaign_run_id = target_run.id
        and event.event_type = 'research_target_increased'
        and (event.details->>'requestedCompanyCount')::integer = requested_count
      order by event.created_at desc limit 1), 0);
    select * into saved_cycle from public.campaign_research_cycles_v2
      where campaign_run_id = target_run.id order by cycle_number desc limit 1;
    return jsonb_build_object('campaignRunId', target_run.id,
      'requestedCompanyCount', requested_count,
      'incrementalAuthorizedCredits', incremental_credits,
      'cycleNumber', saved_cycle.cycle_number,
      'requestedAction', requested_action,
      'idempotent', true);
  end if;
  if requested_count <= target_run.requested_company_count
  then raise exception 'The new company target must be greater than the current target.'; end if;
  if target_run.outcome_settled_at is null
  then raise exception 'Only a completed Company Research outcome can be increased.'; end if;
  if quoted_credits <= target_run.quoted_research_credits
  then raise exception 'The revised quote must increase the maximum authorization.'; end if;
  incremental_credits := quoted_credits - target_run.quoted_research_credits;

  select * into workflow from public.intelligence_workflow_runs
    where campaign_run_id = target_run.id and workspace_id = target_workspace_id
    order by created_at desc limit 1 for update;
  select * into previous_cycle from public.campaign_research_cycles_v2
    where campaign_run_id = target_run.id and workspace_id = target_workspace_id
    order by cycle_number desc limit 1 for update;
  if workflow.id is null or previous_cycle.id is null
  then raise exception 'Company Research continuation state is missing.'; end if;

  insert into public.campaign_run_target_revisions(workspace_id, campaign_run_id,
    previous_requested_company_count, requested_company_count, quote_json,
    quoted_research_credits)
  values(target_workspace_id, target_run.id, target_run.requested_company_count,
    requested_count, target_quote, quoted_credits);

  update public.usage_ledger
  set idempotency_key = 'company-research-outcome:' || target_run.id::text
    || ':target-' || target_run.requested_company_count::text
  where workspace_id = target_workspace_id
    and campaign_run_id = target_run.id
    and idempotency_key = 'company-research-outcome:' || target_run.id::text;

  insert into public.campaign_research_cycles_v2(workspace_id, campaign_id,
    campaign_run_id, cycle_number, continuation_of_cycle_id, status, budget_json)
  values(target_workspace_id, target_run.campaign_id, target_run.id,
    previous_cycle.cycle_number + 1, previous_cycle.id, 'running', previous_cycle.budget_json)
  returning * into saved_cycle;

  update public.campaign_runs set requested_company_count = requested_count,
    outcome_quote_json = target_quote, quoted_research_credits = quoted_credits,
    research_credit_cap = quoted_credits, outcome_state = 'active',
    completion_reason = null, outcome_settlement_json = null, outcome_settled_at = null,
    research_pause_reason = null, status = 'queued', current_phase = 'discovery_queued',
    completed_at = null, cancelled_at = null, failed_at = null,
    error_code = null, error_message = null
  where id = target_run.id;
  update public.intelligence_workflow_runs set status = 'queued', completed_at = null,
    cancelled_at = null, error_summary_json = null
  where id = workflow.id;

  insert into public.campaign_run_events(workspace_id, campaign_run_id, event_type,
    phase, summary, details)
  values(target_workspace_id, target_run.id, 'research_target_increased',
    'discovery_queued', 'Company Research target was increased.',
    jsonb_build_object('previousRequestedCompanyCount', target_run.requested_company_count,
      'requestedCompanyCount', requested_count,
      'incrementalAuthorizedCredits', incremental_credits,
      'requestedAction', requested_action));

  return jsonb_build_object('campaignRunId', target_run.id,
    'requestedCompanyCount', requested_count,
    'incrementalAuthorizedCredits', incremental_credits,
    'cycleNumber', saved_cycle.cycle_number, 'requestedAction', requested_action,
    'idempotent', false);
end; $$;

revoke all on function public.increase_company_research_target(uuid, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.increase_company_research_target(uuid, uuid, jsonb)
  to service_role;
notify pgrst, 'reload schema';
