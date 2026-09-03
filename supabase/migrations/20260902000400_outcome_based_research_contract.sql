-- Persist the quoted Company Research outcome and settle it independently from
-- provider actual-cost accounting. Apply after 20260902000300.

alter table public.campaign_runs
  add column requested_company_count integer not null default 25
    check (requested_company_count between 1 and 500),
  add column outcome_quote_json jsonb
    check (outcome_quote_json is null or jsonb_typeof(outcome_quote_json) = 'object'),
  add column quoted_research_credits numeric(18, 6)
    check (quoted_research_credits is null or quoted_research_credits >= 0),
  add column delivered_company_count integer not null default 0
    check (delivered_company_count >= 0),
  add column outcome_state text not null default 'active'
    check (outcome_state in ('active','target_reached','partial_complete','stopped','failed')),
  add column completion_reason text
    check (completion_reason is null or completion_reason in
      ('target_reached','market_exhausted','user_stopped','internal_cost_guard','provider_failure','technical_failure')),
  add column outcome_settlement_json jsonb
    check (outcome_settlement_json is null or jsonb_typeof(outcome_settlement_json) = 'object'),
  add column outcome_settled_at timestamptz;

update public.campaign_runs
set requested_company_count = least(500, greatest(1,
  case when metadata->>'desiredCompanyCount' ~ '^[0-9]+$'
    then (metadata->>'desiredCompanyCount')::integer else 25 end)),
    delivered_company_count = least(500, greatest(0, companies_qualified));

create table public.campaign_run_target_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  previous_requested_company_count integer not null check (previous_requested_company_count > 0),
  requested_company_count integer not null check (requested_company_count > previous_requested_company_count and requested_company_count <= 500),
  quote_json jsonb not null check (jsonb_typeof(quote_json) = 'object'),
  quoted_research_credits numeric(18, 6) not null check (quoted_research_credits >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_run_id, requested_company_count),
  unique (workspace_id, id)
);

alter table public.campaign_run_target_revisions enable row level security;
create policy campaign_run_target_revisions_select
  on public.campaign_run_target_revisions for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke all on public.campaign_run_target_revisions from anon, authenticated;
grant select on public.campaign_run_target_revisions to authenticated;

create or replace function public.authorize_company_research_outcome(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_quote jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare requested_count integer;
declare quoted_credits numeric(18, 6);
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

  perform pg_advisory_xact_lock(hashtextextended('research-outcome:' || target_campaign_run_id::text, 0));
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
  if target_run.outcome_quote_json is not null then
    if target_run.outcome_quote_json <> target_quote
    then raise exception 'Idempotent outcome authorization input changed.'; end if;
    return jsonb_build_object('campaignRunId', target_run.id,
      'requestedCompanyCount', target_run.requested_company_count,
      'authorizedCredits', target_run.quoted_research_credits, 'idempotent', true);
  end if;

  update public.campaign_runs set
    requested_company_count = requested_count,
    outcome_quote_json = target_quote,
    quoted_research_credits = quoted_credits,
    research_credit_cap = quoted_credits,
    metadata = metadata || jsonb_build_object('desiredCompanyCount', requested_count)
  where id = target_run.id;
  insert into public.campaign_run_events(workspace_id, campaign_run_id, event_type,
    phase, summary, details)
  values(target_workspace_id, target_run.id, 'research_outcome_authorized',
    target_run.current_phase, 'Company Research outcome was authorized.', target_quote);
  return jsonb_build_object('campaignRunId', target_run.id,
    'requestedCompanyCount', requested_count, 'authorizedCredits', quoted_credits,
    'idempotent', false);
end; $$;

create or replace function public.finalize_company_research_outcome(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_completion_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare delivered integer;
declare accrued numeric(18, 6);
declare authorized numeric(18, 6);
declare outcome_ceiling numeric(18, 6);
declare final_charge numeric(18, 6);
declare refund numeric(18, 6);
declare active_reserved numeric(18, 6);
declare final_state text;
declare settlement jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if target_completion_reason not in ('target_reached','market_exhausted','user_stopped',
    'internal_cost_guard','provider_failure','technical_failure')
  then raise exception 'Invalid Company Research completion reason.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-budget:' || target_workspace_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('research-outcome:' || target_campaign_run_id::text, 0));
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
  if target_run.outcome_settled_at is not null then
    return target_run.outcome_settlement_json || jsonb_build_object('idempotent', true);
  end if;
  if target_run.outcome_quote_json is null then raise exception 'Outcome quote is missing.'; end if;

  delivered := least(target_run.requested_company_count,
    greatest(target_run.companies_qualified, target_run.delivered_company_count));
  if target_completion_reason = 'target_reached' and delivered < target_run.requested_company_count
  then raise exception 'Target reached requires the requested number of companies.'; end if;
  accrued := target_run.research_credits_consumed;
  authorized := target_run.quoted_research_credits;
  outcome_ceiling := ceil((authorized *
    (0.2 + 0.8 * delivered::numeric / target_run.requested_company_count)) * 10) / 10;
  final_charge := case
    when target_completion_reason = 'technical_failure' then 0
    when target_completion_reason in ('market_exhausted','internal_cost_guard','provider_failure')
      then least(accrued, authorized, outcome_ceiling)
    else least(accrued, authorized)
  end;
  final_charge := ceil(final_charge * 10) / 10;
  refund := greatest(0, accrued - final_charge);
  select coalesce(sum(reserved_credits), 0) into active_reserved
    from public.budget_reservations where workspace_id = target_workspace_id
      and campaign_run_id = target_campaign_run_id and status = 'reserved';
  update public.budget_reservations set status = 'released', settled_credits = 0,
    settled_at = now() where workspace_id = target_workspace_id
      and campaign_run_id = target_campaign_run_id and status = 'reserved';
  update public.workspace_credit_accounts set
    available_credits = available_credits + active_reserved + refund, updated_at = now()
    where workspace_id = target_workspace_id;

  final_state := case
    when target_completion_reason = 'target_reached' then 'target_reached'
    when target_completion_reason = 'technical_failure' then 'failed'
    when target_completion_reason = 'user_stopped' then 'stopped'
    else 'partial_complete' end;
  settlement := jsonb_build_object('schemaVersion', 1,
    'requestedCompanyCount', target_run.requested_company_count,
    'deliveredCompanyCount', delivered, 'completionReason', target_completion_reason,
    'authorizedCredits', authorized, 'accruedCredits', accrued,
    'finalChargedCredits', final_charge,
    'releasedAuthorizationCredits', greatest(0, authorized - final_charge),
    'refundableCredits', refund,
    'settlementPolicy', 'actual_work_bounded_by_outcome_value_v1');
  update public.campaign_runs set delivered_company_count = delivered,
    outcome_state = final_state, completion_reason = target_completion_reason,
    outcome_settlement_json = settlement, outcome_settled_at = now(),
    research_credits_consumed = final_charge, research_pause_reason = null,
    status = case when final_state = 'target_reached' then 'completed'
      when final_state = 'failed' then 'failed'
      when final_state = 'stopped' then 'cancelled' else 'partially_completed' end,
    current_phase = case when final_state = 'failed' then 'failed'
      when final_state = 'stopped' then 'cancelled' else 'ready_for_review' end,
    completed_at = case when final_state = 'stopped' then completed_at else now() end,
    cancelled_at = case when final_state = 'stopped' then now() else cancelled_at end
  where id = target_run.id;
  if refund > 0 or active_reserved > 0 then
    insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
      idempotency_key, credits, currency, metadata)
    values(target_workspace_id, target_run.id, 'company_research_outcome', 'adjustment',
      'company-research-outcome:' || target_run.id::text,
      -(refund + active_reserved), 'USD', jsonb_build_object(
        'refundCredits', refund, 'releasedReservationCredits', active_reserved));
  end if;
  insert into public.campaign_run_events(workspace_id, campaign_run_id, event_type,
    phase, summary, details)
  values(target_workspace_id, target_run.id, 'research_outcome_settled',
    'ready_for_review', 'Company Research outcome was settled.', settlement);
  return settlement || jsonb_build_object('idempotent', false);
end; $$;

revoke all on function public.authorize_company_research_outcome(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.authorize_company_research_outcome(uuid,uuid,jsonb)
  to service_role;
revoke all on function public.finalize_company_research_outcome(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.finalize_company_research_outcome(uuid,uuid,text)
  to service_role;

notify pgrst, 'reload schema';
