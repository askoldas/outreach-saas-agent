-- Let explicitly exempt test workspaces run through Company Research without
-- campaign or workspace credit interruptions. Provider/runtime safety guards remain.

alter table public.workspace_credit_accounts
  add column if not exists unlimited_research boolean not null default false;

create or replace function public.authorize_company_research_outcome(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_quote jsonb
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  target_run public.campaign_runs;
  account public.workspace_credit_accounts;
  requested_count integer;
  quoted_credits numeric(18, 6);
  effective_cap numeric(18, 6);
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if jsonb_typeof(target_quote) <> 'object'
    or target_quote->>'pricingBasis' <> 'requested_qualified_companies'
    or coalesce((target_quote->>'schemaVersion')::integer, 0) <> 1
  then raise exception 'Invalid Company Research outcome quote.'; end if;
  requested_count := (target_quote->>'requestedCompanyCount')::integer;
  quoted_credits := (target_quote->>'authorizedCredits')::numeric;
  if requested_count not between 1 and 500 or quoted_credits <= 0
  then raise exception 'Invalid Company Research quote values.'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('research-outcome:' || target_campaign_run_id::text, 0));
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  if account.workspace_id is null then raise exception 'Workspace credit account not found.'; end if;
  effective_cap := case when account.unlimited_research then 1000000 else quoted_credits end;

  if target_run.outcome_quote_json is not null then
    if target_run.outcome_quote_json <> target_quote
    then raise exception 'Idempotent outcome authorization input changed.'; end if;
    if account.unlimited_research and target_run.research_credit_cap < effective_cap then
      update public.campaign_runs
      set research_credit_cap = effective_cap, research_pause_reason = null
      where id = target_run.id;
    end if;
    return jsonb_build_object('campaignRunId', target_run.id,
      'requestedCompanyCount', target_run.requested_company_count,
      'authorizedCredits', effective_cap, 'quotedCredits', target_run.quoted_research_credits,
      'unlimitedResearch', account.unlimited_research, 'idempotent', true);
  end if;

  update public.campaign_runs set
    requested_company_count = requested_count,
    outcome_quote_json = target_quote,
    quoted_research_credits = quoted_credits,
    research_credit_cap = effective_cap,
    metadata = metadata || jsonb_build_object('desiredCompanyCount', requested_count)
  where id = target_run.id;
  insert into public.campaign_run_events(workspace_id, campaign_run_id, event_type,
    phase, summary, details)
  values(target_workspace_id, target_run.id, 'research_outcome_authorized',
    target_run.current_phase, 'Company Research outcome was authorized.',
    target_quote || jsonb_build_object('effectiveCreditCap', effective_cap,
      'unlimitedResearch', account.unlimited_research));
  return jsonb_build_object('campaignRunId', target_run.id,
    'requestedCompanyCount', requested_count, 'authorizedCredits', effective_cap,
    'quotedCredits', quoted_credits, 'unlimitedResearch', account.unlimited_research,
    'idempotent', false);
end; $$;

revoke all on function public.authorize_company_research_outcome(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.authorize_company_research_outcome(uuid,uuid,jsonb)
  to service_role;

notify pgrst, 'reload schema';
