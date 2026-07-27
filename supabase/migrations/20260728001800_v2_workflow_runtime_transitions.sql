-- Atomic runtime transitions for the Intelligence V2 Trigger workflow.
-- Apply after 20260728001700_repair_semantic_discovery_coverage.sql.

create or replace function public.ensure_campaign_workflow_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_input_reference jsonb
)
returns public.intelligence_workflow_runs
language plpgsql
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  workflow_version public.workflow_versions;
  saved public.intelligence_workflow_runs;
begin
  if jsonb_typeof(target_input_reference) <> 'object' then
    raise exception 'V2 workflow input reference must be an object.';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id;

  if campaign_run.id is null then
    raise exception 'V2 Campaign Run was not found in the workspace.';
  end if;
  if campaign_run.workflow_version <> 'v2' then
    raise exception 'V2 workflow cannot execute a non-V2 Campaign Run.';
  end if;

  select * into workflow_version
  from public.workflow_versions
  where workflow_family = 'campaign'
    and version = 'v2';

  if workflow_version.id is null then
    raise exception 'Campaign workflow version v2 is not registered.';
  end if;

  insert into public.intelligence_workflow_runs (
    workspace_id,
    workflow_version_id,
    campaign_run_id,
    workflow_family,
    subject_type,
    subject_id,
    status,
    input_reference_json
  ) values (
    target_workspace_id,
    workflow_version.id,
    target_campaign_run_id,
    'campaign_v2',
    'campaign_run',
    target_campaign_run_id,
    'queued',
    target_input_reference
  )
  on conflict (campaign_run_id)
  do update set input_reference_json =
    public.intelligence_workflow_runs.input_reference_json
  returning * into saved;

  if saved.workspace_id <> target_workspace_id then
    raise exception 'V2 workflow workspace mismatch.';
  end if;
  return saved;
end;
$$;

create or replace function public.claim_intelligence_task_v2(
  target_workspace_id uuid,
  target_workflow_run_id uuid,
  target_task_type text,
  target_idempotency_key text,
  target_input_fingerprint text,
  target_input_reference jsonb,
  target_trigger_run_id text default null,
  target_parent_task_run_id uuid default null
)
returns public.intelligence_task_runs
language plpgsql
set search_path = public
as $$
declare
  saved public.intelligence_task_runs;
  next_attempt integer;
begin
  if length(trim(target_task_type)) = 0
    or length(trim(target_idempotency_key)) = 0
    or length(trim(target_input_fingerprint)) = 0 then
    raise exception 'V2 task identity fields must not be empty.';
  end if;
  if jsonb_typeof(target_input_reference) <> 'object' then
    raise exception 'V2 task input reference must be an object.';
  end if;
  if not exists (
    select 1 from public.intelligence_workflow_runs
    where id = target_workflow_run_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'V2 workflow was not found in the workspace.';
  end if;

  insert into public.intelligence_task_runs (
    workspace_id,
    workflow_run_id,
    parent_task_run_id,
    task_type,
    idempotency_key,
    input_fingerprint,
    input_reference_json
  ) values (
    target_workspace_id,
    target_workflow_run_id,
    target_parent_task_run_id,
    target_task_type,
    target_idempotency_key,
    target_input_fingerprint,
    target_input_reference
  )
  on conflict (idempotency_key) do nothing;

  select * into saved
  from public.intelligence_task_runs
  where idempotency_key = target_idempotency_key
  for update;

  if saved.workspace_id <> target_workspace_id
    or saved.workflow_run_id <> target_workflow_run_id
    or saved.task_type <> target_task_type
    or saved.input_fingerprint <> target_input_fingerprint then
    raise exception 'V2 task idempotency key was reused with different input.';
  end if;

  if saved.status in ('completed', 'partial', 'cancelled', 'skipped') then
    return saved;
  end if;
  if saved.status = 'running'
    and saved.trigger_run_id is not distinct from target_trigger_run_id then
    return saved;
  end if;

  next_attempt := saved.attempt_count + 1;
  update public.intelligence_task_runs
  set status = 'running',
      attempt_count = next_attempt,
      trigger_run_id = target_trigger_run_id,
      started_at = coalesce(started_at, now()),
      completed_at = null,
      error_code = null,
      error_details_json = null
  where id = saved.id
  returning * into saved;

  insert into public.intelligence_task_attempts (
    workspace_id,
    task_run_id,
    attempt_number,
    trigger_execution_id,
    status
  ) values (
    target_workspace_id,
    saved.id,
    next_attempt,
    target_trigger_run_id,
    'running'
  );

  return saved;
end;
$$;

create or replace function public.complete_intelligence_task_v2(
  target_workspace_id uuid,
  target_task_run_id uuid,
  target_status text,
  target_output_reference jsonb,
  target_metrics jsonb default '{}'::jsonb
)
returns public.intelligence_task_runs
language plpgsql
set search_path = public
as $$
declare saved public.intelligence_task_runs;
begin
  if target_status not in ('completed', 'partial', 'blocked', 'skipped') then
    raise exception 'Invalid V2 task completion status.';
  end if;
  if jsonb_typeof(target_output_reference) <> 'object'
    or jsonb_typeof(target_metrics) <> 'object' then
    raise exception 'V2 task output and metrics must be objects.';
  end if;

  select * into saved
  from public.intelligence_task_runs
  where id = target_task_run_id
    and workspace_id = target_workspace_id
  for update;

  if saved.id is null then
    raise exception 'V2 task was not found in the workspace.';
  end if;
  if saved.status in ('completed', 'partial', 'skipped') then
    return saved;
  end if;
  if saved.status <> 'running' then
    raise exception 'Only a running V2 task can complete.';
  end if;

  update public.intelligence_task_attempts
  set status = 'completed',
      completed_at = now(),
      metrics_json = target_metrics
  where task_run_id = saved.id
    and attempt_number = saved.attempt_count
    and status = 'running';

  update public.intelligence_task_runs
  set status = target_status,
      output_reference_json = target_output_reference,
      completed_at = case when target_status = 'blocked' then null else now() end
  where id = saved.id
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.fail_intelligence_task_attempt_v2(
  target_workspace_id uuid,
  target_task_run_id uuid,
  target_error_code text,
  target_error_details jsonb,
  target_retryable boolean
)
returns public.intelligence_task_runs
language plpgsql
set search_path = public
as $$
declare saved public.intelligence_task_runs;
begin
  if jsonb_typeof(target_error_details) <> 'object' then
    raise exception 'V2 task error details must be an object.';
  end if;

  select * into saved
  from public.intelligence_task_runs
  where id = target_task_run_id
    and workspace_id = target_workspace_id
  for update;

  if saved.id is null then
    raise exception 'V2 task was not found in the workspace.';
  end if;
  if saved.status <> 'running' then
    return saved;
  end if;

  update public.intelligence_task_attempts
  set status = 'failed',
      completed_at = now(),
      error_code = target_error_code,
      metrics_json = target_error_details
  where task_run_id = saved.id
    and attempt_number = saved.attempt_count
    and status = 'running';

  update public.intelligence_task_runs
  set status = case when target_retryable then 'retry_wait' else 'failed' end,
      error_code = target_error_code,
      error_details_json = target_error_details,
      completed_at = case when target_retryable then null else now() end
  where id = saved.id
  returning * into saved;

  return saved;
end;
$$;

create or replace function public.save_workflow_checkpoint_v2(
  target_workspace_id uuid,
  target_workflow_run_id uuid,
  target_checkpoint_key text,
  target_payload jsonb
)
returns public.workflow_checkpoints
language plpgsql
set search_path = public
as $$
declare
  next_version integer;
  saved public.workflow_checkpoints;
begin
  if length(trim(target_checkpoint_key)) = 0
    or jsonb_typeof(target_payload) <> 'object' then
    raise exception 'Invalid V2 workflow checkpoint.';
  end if;

  perform 1
  from public.intelligence_workflow_runs
  where id = target_workflow_run_id
    and workspace_id = target_workspace_id
  for update;
  if not found then
    raise exception 'V2 workflow was not found in the workspace.';
  end if;

  select coalesce(max(checkpoint_version), 0) + 1
  into next_version
  from public.workflow_checkpoints
  where workflow_run_id = target_workflow_run_id
    and checkpoint_key = target_checkpoint_key;

  insert into public.workflow_checkpoints (
    workspace_id,
    workflow_run_id,
    checkpoint_key,
    checkpoint_version,
    payload_json
  ) values (
    target_workspace_id,
    target_workflow_run_id,
    target_checkpoint_key,
    next_version,
    target_payload
  )
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.ensure_campaign_workflow_v2(uuid, uuid, jsonb)
from anon, authenticated;
revoke all on function public.claim_intelligence_task_v2(
  uuid, uuid, text, text, text, jsonb, text, uuid
) from anon, authenticated;
revoke all on function public.complete_intelligence_task_v2(
  uuid, uuid, text, jsonb, jsonb
) from anon, authenticated;
revoke all on function public.fail_intelligence_task_attempt_v2(
  uuid, uuid, text, jsonb, boolean
) from anon, authenticated;
revoke all on function public.save_workflow_checkpoint_v2(
  uuid, uuid, text, jsonb
) from anon, authenticated;

grant execute on function public.ensure_campaign_workflow_v2(uuid, uuid, jsonb)
to service_role;
grant execute on function public.claim_intelligence_task_v2(
  uuid, uuid, text, text, text, jsonb, text, uuid
) to service_role;
grant execute on function public.complete_intelligence_task_v2(
  uuid, uuid, text, jsonb, jsonb
) to service_role;
grant execute on function public.fail_intelligence_task_attempt_v2(
  uuid, uuid, text, jsonb, boolean
) to service_role;
grant execute on function public.save_workflow_checkpoint_v2(
  uuid, uuid, text, jsonb
) to service_role;
