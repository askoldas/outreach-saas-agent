-- Persist expected budget exhaustion as a blocked member, not a failed Trigger run.

create or replace function public.block_candidate_research_member_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_error_code text,
  target_error_message text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_research_batch_members_v2;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select * into member
  from public.candidate_research_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;

  if member.id is null then
    raise exception 'Candidate Research member not found.';
  end if;

  if member.status in ('completed', 'blocked') then
    return jsonb_build_object(
      'memberId', member.id,
      'status', member.status,
      'idempotent', true
    );
  end if;

  update public.candidate_research_batch_members_v2
  set status = 'blocked',
      error_code = left(coalesce(target_error_code, 'research_budget'), 120),
      output_reference_json = jsonb_build_object(
        'schemaVersion', 2,
        'memberId', member.id,
        'campaignCandidateId', member.campaign_candidate_id,
        'status', 'blocked',
        'reason', 'research_budget',
        'message', left(coalesce(target_error_message, 'Research budget unavailable.'), 1000)
      ),
      completed_at = now()
  where id = member.id;

  update public.candidate_research_plans
  set status = 'blocked'
  where id = member.research_plan_id
    and workspace_id = target_workspace_id
    and status in ('ready', 'running');

  return jsonb_build_object(
    'memberId', member.id,
    'status', 'blocked',
    'idempotent', false
  );
end;
$$;

revoke all on function public.block_candidate_research_member_v2(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.block_candidate_research_member_v2(
  uuid, uuid, text, text
) to service_role;

-- Additional authorization reopens only members blocked by the budget boundary.
-- Genuine evidence/validation failures remain blocked for operator inspection.
create or replace function public.authorize_additional_research_credits(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_additional_credits numeric
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_run public.campaign_runs;
  account public.workspace_credit_accounts;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if target_additional_credits <= 0 then
    raise exception 'Additional authorization must be positive.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('research-budget:' || target_workspace_id::text, 0)
  );
  select * into target_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2'
  for update;
  if target_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into account
  from public.workspace_credit_accounts
  where workspace_id = target_workspace_id
  for update;
  if account.workspace_id is null or account.available_credits <= 0 then
    raise exception 'Workspace credit balance exhausted.';
  end if;

  update public.campaign_runs
  set research_credit_cap = research_credit_cap + target_additional_credits,
      research_pause_reason = null
  where id = target_run.id
  returning * into target_run;

  update public.candidate_research_plans plan
  set status = 'ready'
  from public.candidate_research_batch_members_v2 member,
       public.candidate_research_batches_v2 batch
  where member.research_plan_id = plan.id
    and member.candidate_research_batch_id = batch.id
    and batch.campaign_run_id = target_campaign_run_id
    and batch.workspace_id = target_workspace_id
    and member.status = 'blocked'
    and member.error_code like 'research_budget_%';

  update public.candidate_research_batch_members_v2 member
  set status = 'queued',
      trigger_run_id = null,
      error_code = null,
      output_reference_json = null,
      completed_at = null
  from public.candidate_research_batches_v2 batch
  where member.candidate_research_batch_id = batch.id
    and batch.campaign_run_id = target_campaign_run_id
    and batch.workspace_id = target_workspace_id
    and member.status = 'blocked'
    and member.error_code like 'research_budget_%';

  update public.candidate_research_batches_v2
  set status = 'running',
      blocked_count = 0,
      summary_json = null,
      completed_at = null
  where campaign_run_id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and status = 'partial';

  return jsonb_build_object(
    'campaignRunId', target_run.id,
    'authorizedCredits', target_run.research_credit_cap,
    'consumedCredits', target_run.research_credits_consumed,
    'workspaceAvailableCredits', account.available_credits
  );
end;
$$;

revoke all on function public.authorize_additional_research_credits(
  uuid, uuid, numeric
) from public, anon;
grant execute on function public.authorize_additional_research_credits(
  uuid, uuid, numeric
) to authenticated, service_role;

notify pgrst, 'reload schema';
