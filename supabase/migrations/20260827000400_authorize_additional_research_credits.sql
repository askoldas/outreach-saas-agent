-- Increase the authorization on the same Campaign Run before durable continuation.

create or replace function public.authorize_additional_research_credits(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_additional_credits numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare account public.workspace_credit_accounts;
begin
  if auth.role() <> 'service_role' and not public.is_workspace_admin(target_workspace_id)
  then raise exception 'Forbidden'; end if;
  if target_additional_credits <= 0 then raise exception 'Additional authorization must be positive.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-budget:' || target_workspace_id::text, 0));
  select * into target_run from public.campaign_runs where id = target_campaign_run_id
    and workspace_id = target_workspace_id and workflow_version = 'v2' for update;
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'V2 Campaign Run not found.'; end if;
  if account.workspace_id is null or account.available_credits <= 0
  then raise exception 'Workspace credit balance exhausted.'; end if;
  update public.campaign_runs set
    research_credit_cap = research_credit_cap + target_additional_credits,
    research_pause_reason = null
    where id = target_run.id returning * into target_run;
  return jsonb_build_object(
    'campaignRunId', target_run.id,
    'authorizedCredits', target_run.research_credit_cap,
    'consumedCredits', target_run.research_credits_consumed,
    'workspaceAvailableCredits', account.available_credits
  );
end; $$;

revoke all on function public.authorize_additional_research_credits(uuid,uuid,numeric)
  from public, anon;
grant execute on function public.authorize_additional_research_credits(uuid,uuid,numeric)
  to authenticated, service_role;
