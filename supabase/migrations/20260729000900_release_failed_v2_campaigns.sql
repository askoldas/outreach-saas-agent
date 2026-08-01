create or replace function public.settle_campaign_workflow_v2(
  target_workspace_id uuid,
  target_workflow_run_id uuid,
  target_status text,
  target_progress_summary jsonb default null,
  target_output_reference jsonb default null,
  target_error_summary jsonb default null,
  target_trigger_run_id text default null
)
returns public.intelligence_workflow_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  workflow public.intelligence_workflow_runs;
  saved public.intelligence_workflow_runs;
  run_status text;
  run_phase text;
  run_progress integer;
  campaign_status text;
  is_terminal boolean;
begin
  if target_status not in (
    'queued', 'initializing', 'discovering', 'resolving_entities',
    'evaluating_candidates', 'ranking', 'ready_for_review', 'paused',
    'cancelled', 'completed', 'completed_partial', 'failed'
  ) then
    raise exception 'Invalid V2 workflow settlement status.';
  end if;
  if target_progress_summary is not null
    and jsonb_typeof(target_progress_summary) <> 'object'
  then
    raise exception 'V2 workflow progress must be an object.';
  end if;

  select *
  into workflow
  from public.intelligence_workflow_runs
  where id = target_workflow_run_id
    and workspace_id = target_workspace_id
  for update;

  if workflow.id is null then
    raise exception 'V2 workflow was not found.';
  end if;
  if workflow.status in (
    'ready_for_review', 'cancelled', 'completed', 'completed_partial', 'failed'
  ) then
    return workflow;
  end if;
  if workflow.status = 'paused'
    and target_status not in ('queued', 'cancelled', 'failed')
  then
    return workflow;
  end if;

  is_terminal := target_status in (
    'ready_for_review', 'cancelled', 'completed', 'completed_partial', 'failed'
  );
  update public.intelligence_workflow_runs
  set status = target_status,
      trigger_run_id = coalesce(target_trigger_run_id, trigger_run_id),
      progress_summary_json = coalesce(
        target_progress_summary,
        progress_summary_json
      ),
      output_reference_json = coalesce(
        target_output_reference,
        output_reference_json
      ),
      error_summary_json = case
        when target_error_summary is not null then target_error_summary
        when target_status not in ('failed') then null
        else error_summary_json
      end,
      started_at = case
        when target_status = 'initializing' then coalesce(started_at, now())
        else started_at
      end,
      completed_at = case when is_terminal then now() else null end,
      paused_at = case
        when target_status = 'paused' then now()
        when target_status = 'queued' then null
        else paused_at
      end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end
  where id = workflow.id
  returning * into saved;

  run_status := case
    when target_status = 'queued' then 'queued'
    when target_status = 'initializing' then 'planning'
    when target_status = 'discovering' then 'discovering'
    when target_status in ('resolving_entities', 'evaluating_candidates') then 'evaluating'
    when target_status = 'ranking' then 'qualifying'
    when target_status in ('ready_for_review', 'completed') then 'completed'
    when target_status = 'completed_partial' then 'partially_completed'
    when target_status = 'paused' then 'waiting_for_input'
    when target_status = 'cancelled' then 'cancelled'
    else 'failed'
  end;
  run_phase := case
    when target_status = 'ready_for_review' then 'ready_for_review'
    else target_status
  end;
  run_progress := case
    when target_progress_summary is not null
      and target_progress_summary ? 'stagePercent'
    then greatest(
      0,
      least(100, (target_progress_summary->>'stagePercent')::integer)
    )
    when target_status in ('ready_for_review', 'completed', 'completed_partial') then 100
    else null
  end;
  campaign_status := case
    when target_status = 'paused' then 'paused'
    when target_status in (
      'ready_for_review', 'completed', 'completed_partial', 'cancelled', 'failed'
    ) then 'completed'
    else 'active'
  end;

  update public.campaign_runs
  set status = run_status,
      current_phase = run_phase,
      progress_percentage = coalesce(run_progress, progress_percentage),
      trigger_run_id = coalesce(target_trigger_run_id, trigger_run_id),
      started_at = case
        when target_status = 'initializing' then coalesce(started_at, now())
        else started_at
      end,
      completed_at = case
        when target_status in ('ready_for_review', 'completed', 'completed_partial')
        then now()
        else null
      end,
      failed_at = case when target_status = 'failed' then now() else null end,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      error_code = case when target_status = 'failed' then 'workflow_failed' else null end,
      error_message = case
        when target_status = 'failed'
        then coalesce(target_error_summary->>'message', 'V2 workflow failed.')
        else null
      end
  where id = workflow.campaign_run_id
    and workspace_id = target_workspace_id;

  update public.campaigns campaign
  set status = campaign_status,
      updated_at = now()
  from public.campaign_runs campaign_run
  where campaign_run.id = workflow.campaign_run_id
    and campaign.id = campaign_run.campaign_id
    and campaign.workspace_id = target_workspace_id;

  return saved;
end;
$$;

update public.campaigns campaign
set status = 'completed',
    updated_at = now()
where campaign.status = 'paused'
  and (
    select campaign_run.status
    from public.campaign_runs campaign_run
    where campaign_run.workspace_id = campaign.workspace_id
      and campaign_run.campaign_id = campaign.id
      and campaign_run.workflow_version = 'v2'
    order by campaign_run.created_at desc, campaign_run.id desc
    limit 1
  ) = 'failed';

revoke all on function public.settle_campaign_workflow_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;
grant execute on function public.settle_campaign_workflow_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, text
) to service_role;
