-- Allow a designated test workspace to activate V2 before retaining a fresh
-- end-to-end run. The explicit waiver, audit, kill switches, and rollback remain.

create or replace function public.enable_workspace_controlled_beta_v2(
  target_workspace_id uuid,
  target_benchmark_waived boolean,
  target_reason text
)
returns public.workspace_intelligence_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_settings public.workspace_intelligence_settings;
  next_settings public.workspace_intelligence_settings;
  reviewable_run_count integer;
  unresolved_entity_case_count integer;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_benchmark_waived is not true then
    raise exception 'Controlled beta requires benchmark evidence or an explicit waiver';
  end if;
  if length(trim(coalesce(target_reason, ''))) < 16 then
    raise exception 'A specific controlled-beta authorization reason is required';
  end if;

  select * into previous_settings
  from public.workspace_intelligence_settings
  where workspace_id = target_workspace_id
  for update;

  if previous_settings.workspace_id is null then
    raise exception 'Workspace Intelligence settings were not found';
  end if;

  select count(*)::integer into reviewable_run_count
  from public.campaign_runs
  where workspace_id = target_workspace_id
    and workflow_version = 'v2'
    and status in ('completed', 'ready_for_review', 'partial');

  select count(*)::integer into unresolved_entity_case_count
  from public.entity_resolution_cases resolution_case
  join public.campaign_runs campaign_run
    on campaign_run.id = resolution_case.campaign_run_id
    and campaign_run.workspace_id = resolution_case.workspace_id
  where resolution_case.workspace_id = target_workspace_id
    and campaign_run.workflow_version = 'v2'
    and resolution_case.status <> 'resolved';

  update public.workspace_intelligence_settings
  set
    profile_version = 'v2',
    campaign_workflow = 'v2',
    shadow_mode = false,
    result_write_mode = 'canonical',
    enabled_providers = case
      when 'web' = any(enabled_providers) then enabled_providers
      else array_append(enabled_providers, 'web')
    end,
    updated_by = auth.uid()
  where workspace_id = target_workspace_id
  returning * into next_settings;

  insert into public.intelligence_rollout_audit_events (
    workspace_id,
    event_type,
    previous_settings_json,
    next_settings_json,
    evidence_json,
    reason,
    actor_user_id
  ) values (
    target_workspace_id,
    'controlled_beta_enabled',
    to_jsonb(previous_settings),
    to_jsonb(next_settings),
    jsonb_build_object(
      'benchmarkWaived', true,
      'priorRunGateWaived', reviewable_run_count = 0,
      'freshValidationRequired', true,
      'reviewableV2RunCountAtActivation', reviewable_run_count,
      'historicalUnresolvedEntityCaseCount', unresolved_entity_case_count,
      'activationScope', 'workspace'
    ),
    trim(target_reason),
    auth.uid()
  );

  return next_settings;
end;
$$;

revoke all on function public.enable_workspace_controlled_beta_v2(
  uuid, boolean, text
) from public, anon;
grant execute on function public.enable_workspace_controlled_beta_v2(
  uuid, boolean, text
) to authenticated;
