-- Atomic V2 workflow controls, progress reconciliation, and terminal settlement.
-- Apply after 20260728002700_retry_safe_comparative_ranking_stage.sql.

create unique index workflow_commands_one_pending_type_idx
on public.workflow_commands(workspace_id, subject_id, command_type)
where status = 'pending';

drop policy if exists "Admins can manage intelligence_workflow_runs"
on public.intelligence_workflow_runs;
drop policy if exists "Admins can manage intelligence_task_runs"
on public.intelligence_task_runs;
drop policy if exists "Admins can manage intelligence_task_attempts"
on public.intelligence_task_attempts;
drop policy if exists "Admins can manage workflow_checkpoints"
on public.workflow_checkpoints;
drop policy if exists "Admins can manage workflow_commands"
on public.workflow_commands;
drop policy if exists "Admins can manage workflow_outbox"
on public.workflow_outbox;

create or replace function public.request_campaign_workflow_command_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_command_type text,
  target_payload jsonb default '{}'::jsonb
)
returns public.workflow_commands
language plpgsql
security definer
set search_path = public
as $$
declare
  workflow public.intelligence_workflow_runs;
  saved public.workflow_commands;
begin
  if target_command_type not in ('pause', 'resume', 'cancel')
    or jsonb_typeof(target_payload) <> 'object'
  then
    raise exception 'Invalid V2 workflow command.';
  end if;
  if auth.uid() is null
    or not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Workspace administrator access is required.';
  end if;

  select *
  into workflow
  from public.intelligence_workflow_runs
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
  for update;

  if workflow.id is null then
    raise exception 'V2 workflow was not found.';
  end if;
  if workflow.status in (
    'ready_for_review', 'cancelled', 'completed', 'completed_partial', 'failed'
  ) then
    raise exception 'Terminal V2 workflows cannot accept control commands.';
  end if;
  if target_command_type = 'resume' and workflow.status <> 'paused' then
    raise exception 'Only a paused V2 workflow can resume.';
  end if;
  if target_command_type = 'pause' and workflow.status = 'paused' then
    raise exception 'The V2 workflow is already paused.';
  end if;

  insert into public.workflow_commands (
    workspace_id,
    command_type,
    subject_type,
    subject_id,
    payload_json,
    requested_by_user_id
  )
  values (
    target_workspace_id,
    target_command_type,
    'campaign_run',
    target_campaign_run_id,
    target_payload,
    auth.uid()
  )
  on conflict (workspace_id, subject_id, command_type)
    where status = 'pending'
  do update set payload_json = excluded.payload_json
  returning * into saved;

  if target_command_type in ('pause', 'cancel') then
    update public.intelligence_workflow_runs
    set status = case
      when target_command_type = 'cancel' then 'cancelling'
      else 'pausing'
    end
    where id = workflow.id;
    update public.campaign_runs
    set current_phase = case
      when target_command_type = 'cancel' then 'cancel_requested'
      else 'pause_requested'
    end
    where id = target_campaign_run_id
      and workspace_id = target_workspace_id;
  end if;

  insert into public.workflow_outbox (
    workspace_id,
    command_id,
    event_type,
    payload_json
  )
  values (
    target_workspace_id,
    saved.id,
    'campaign_v2.command_requested',
    jsonb_build_object(
      'campaignRunId', target_campaign_run_id,
      'commandType', target_command_type
    )
  );

  return saved;
end;
$$;

create or replace function public.consume_campaign_workflow_control_v2(
  target_workspace_id uuid,
  target_workflow_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  workflow public.intelligence_workflow_runs;
  command public.workflow_commands;
  campaign_run public.campaign_runs;
  control_state text := 'run';
begin
  select *
  into workflow
  from public.intelligence_workflow_runs
  where id = target_workflow_run_id
    and workspace_id = target_workspace_id
  for update;

  if workflow.id is null then
    raise exception 'V2 workflow was not found.';
  end if;
  if workflow.status = 'cancelled' then
    return jsonb_build_object(
      'state', 'cancelled',
      'workflowRunId', workflow.id,
      'campaignRunId', workflow.campaign_run_id,
      'commandId', null
    );
  end if;
  if workflow.status in (
    'ready_for_review', 'completed', 'completed_partial', 'failed'
  ) then
    return jsonb_build_object(
      'state', 'terminal',
      'workflowRunId', workflow.id,
      'campaignRunId', workflow.campaign_run_id,
      'commandId', null
    );
  end if;

  select *
  into command
  from public.workflow_commands
  where workspace_id = target_workspace_id
    and subject_type = 'campaign_run'
    and subject_id = workflow.campaign_run_id
    and status = 'pending'
  order by
    case command_type when 'cancel' then 0 when 'pause' then 1 else 2 end,
    created_at desc
  limit 1
  for update;

  if command.id is null then
    control_state := case when workflow.status = 'paused' then 'paused' else 'run' end;
    return jsonb_build_object(
      'state', control_state,
      'workflowRunId', workflow.id,
      'campaignRunId', workflow.campaign_run_id,
      'commandId', null
    );
  end if;

  update public.workflow_commands
  set status = 'processing'
  where id = command.id;

  select *
  into campaign_run
  from public.campaign_runs
  where id = workflow.campaign_run_id
    and workspace_id = target_workspace_id
  for update;

  if campaign_run.id is null then
    raise exception 'V2 Campaign Run was not found.';
  end if;

  if command.command_type = 'cancel' then
    control_state := 'cancelled';
    update public.intelligence_task_attempts attempt
    set status = 'cancelled',
        completed_at = now(),
        error_code = 'workflow_cancelled'
    from public.intelligence_task_runs task
    where task.workflow_run_id = workflow.id
      and attempt.task_run_id = task.id
      and attempt.status = 'running';
    update public.intelligence_task_runs
    set status = 'cancelled',
        completed_at = now(),
        error_code = 'workflow_cancelled',
        error_details_json = jsonb_build_object(
          'message', 'Campaign workflow cancelled by the user.'
        )
    where workflow_run_id = workflow.id
      and status in ('pending', 'claimed', 'running', 'retry_wait', 'blocked');
    update public.intelligence_workflow_runs
    set status = 'cancelled',
        completed_at = now(),
        cancelled_at = now(),
        output_reference_json = coalesce(output_reference_json, '{}'::jsonb)
          || jsonb_build_object('cancelCommandId', command.id)
    where id = workflow.id;
    update public.campaign_runs
    set status = 'cancelled',
        current_phase = 'cancelled',
        cancelled_at = now(),
        completed_at = null,
        failed_at = null,
        error_code = 'campaign_cancelled',
        error_message = 'Campaign stopped by the user.',
        progress_percentage = least(progress_percentage, 99)
    where id = campaign_run.id;
    update public.campaigns
    set status = 'completed',
        updated_at = now()
    where id = campaign_run.campaign_id
      and workspace_id = target_workspace_id;
  elsif command.command_type = 'pause' then
    control_state := 'paused';
    update public.intelligence_workflow_runs
    set status = 'paused',
        paused_at = now()
    where id = workflow.id;
    update public.campaign_runs
    set status = 'waiting_for_input',
        current_phase = 'paused',
        error_code = null,
        error_message = null
    where id = campaign_run.id;
    update public.campaigns
    set status = 'paused',
        updated_at = now()
    where id = campaign_run.campaign_id
      and workspace_id = target_workspace_id;
  else
    control_state := 'run';
    update public.intelligence_workflow_runs
    set status = 'queued',
        paused_at = null,
        completed_at = null,
        error_summary_json = null
    where id = workflow.id;
    update public.campaign_runs
    set status = 'queued',
        current_phase = 'resume_queued',
        error_code = null,
        error_message = null,
        completed_at = null,
        failed_at = null,
        cancelled_at = null
    where id = campaign_run.id;
    update public.campaigns
    set status = 'active',
        updated_at = now()
    where id = campaign_run.campaign_id
      and workspace_id = target_workspace_id;
  end if;

  update public.workflow_commands
  set status = 'completed',
      processed_at = now()
  where id = command.id;

  update public.workflow_commands
  set status = 'superseded',
      processed_at = now()
  where workspace_id = target_workspace_id
    and subject_id = workflow.campaign_run_id
    and status = 'pending'
    and id <> command.id;

  insert into public.workflow_outbox (
    workspace_id,
    command_id,
    event_type,
    payload_json
  )
  values (
    target_workspace_id,
    command.id,
    'campaign_v2.command_processed',
    jsonb_build_object(
      'campaignRunId', workflow.campaign_run_id,
      'commandType', command.command_type,
      'state', control_state
    )
  );

  insert into public.campaign_run_events (
    workspace_id,
    campaign_run_id,
    event_type,
    phase,
    summary,
    details
  )
  values (
    target_workspace_id,
    workflow.campaign_run_id,
    'campaign_v2_control',
    control_state,
    case
      when control_state = 'cancelled' then 'Campaign workflow cancelled.'
      when control_state = 'paused' then 'Campaign workflow paused at a safe point.'
      else 'Campaign workflow resumed from its durable checkpoint.'
    end,
    jsonb_build_object(
      'commandId', command.id,
      'commandType', command.command_type
    )
  );

  return jsonb_build_object(
    'state', control_state,
    'workflowRunId', workflow.id,
    'campaignRunId', workflow.campaign_run_id,
    'commandId', command.id
  );
end;
$$;

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
      'ready_for_review', 'completed', 'completed_partial', 'cancelled'
    ) then 'completed'
    when target_status = 'failed' then 'paused'
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

revoke all on function public.request_campaign_workflow_command_v2(
  uuid, uuid, text, jsonb
) from public, anon;
grant execute on function public.request_campaign_workflow_command_v2(
  uuid, uuid, text, jsonb
) to authenticated;

revoke all on function public.consume_campaign_workflow_control_v2(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.settle_campaign_workflow_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.consume_campaign_workflow_control_v2(uuid, uuid)
to service_role;
grant execute on function public.settle_campaign_workflow_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, text
) to service_role;
