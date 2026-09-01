-- A provider can report more usage than its conservative reservation. Always close the
-- reservation and preserve actual cost, but never charge beyond the Campaign Run cap or
-- Workspace balance. Any uncharged overage pauses further work for explicit authorization.

create or replace function public.settle_research_credits(
  target_workspace_id uuid, target_campaign_run_id uuid, target_reservation_id uuid,
  target_idempotency_key text, target_provider text, target_operation text,
  target_model text, target_provider_request_id text, target_raw_usage jsonb,
  target_actual_cost_usd numeric, target_billable_cost_usd numeric,
  target_opptium_credits numeric, target_company_id uuid, target_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare reservation public.budget_reservations;
declare existing public.usage_ledger;
declare target_run public.campaign_runs;
declare account public.workspace_credit_accounts;
declare other_reserved numeric(18, 6);
declare chargeable_credits numeric(18, 6);
declare extra numeric(18, 6);
declare refund numeric(18, 6);
declare pause_reason text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if least(target_actual_cost_usd, target_billable_cost_usd, target_opptium_credits) < 0
  then raise exception 'Usage values cannot be negative.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-budget:' || target_workspace_id::text, 0));
  select * into existing from public.usage_ledger where workspace_id = target_workspace_id
    and entry_type = 'settlement' and idempotency_key = target_idempotency_key;
  if existing.id is not null then return jsonb_build_object('id', existing.id,
    'opptiumCredits', existing.opptium_credits, 'idempotent', true); end if;
  select * into reservation from public.budget_reservations
    where id = target_reservation_id and workspace_id = target_workspace_id
      and campaign_run_id = target_campaign_run_id for update;
  if reservation.id is null or reservation.status <> 'reserved'
  then raise exception 'Active credit reservation not found.'; end if;
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  if target_run.id is null or account.workspace_id is null
  then raise exception 'Research credit owner not found.'; end if;
  select coalesce(sum(reserved_credits), 0) into other_reserved
    from public.budget_reservations where campaign_run_id = target_campaign_run_id
      and status = 'reserved' and id <> reservation.id;

  chargeable_credits := least(
    target_opptium_credits,
    reservation.reserved_credits + account.available_credits,
    greatest(0, target_run.research_credit_cap - target_run.research_credits_consumed - other_reserved)
  );
  chargeable_credits := greatest(0, chargeable_credits);
  extra := greatest(0, chargeable_credits - reservation.reserved_credits);
  refund := greatest(0, reservation.reserved_credits - chargeable_credits);
  if chargeable_credits < target_opptium_credits then
    pause_reason := case
      when reservation.reserved_credits + account.available_credits < target_opptium_credits
        then 'workspace_balance'
      else 'campaign_budget'
    end;
  end if;

  update public.workspace_credit_accounts set
    available_credits = available_credits - extra + refund, updated_at = now()
    where workspace_id = target_workspace_id;
  update public.budget_reservations set status = 'settled',
    settled_amount = target_billable_cost_usd, settled_credits = chargeable_credits,
    settled_at = now() where id = reservation.id;
  update public.campaign_runs set
    research_credits_consumed = research_credits_consumed + chargeable_credits,
    research_pause_reason = pause_reason where id = target_campaign_run_id;
  insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
    idempotency_key, credits, amount, currency, provider, model, provider_request_id,
    company_id, raw_provider_usage, actual_cost_usd, billable_cost_usd,
    opptium_credits, metadata)
  values(target_workspace_id, target_campaign_run_id, target_operation, 'settlement',
    target_idempotency_key, chargeable_credits, target_billable_cost_usd, 'USD',
    target_provider, target_model, target_provider_request_id, target_company_id,
    target_raw_usage, target_actual_cost_usd, target_billable_cost_usd,
    chargeable_credits, coalesce(target_metadata, '{}'::jsonb) || jsonb_build_object(
      'requestedOpptiumCredits', target_opptium_credits,
      'unchargedOverageCredits', target_opptium_credits - chargeable_credits,
      'pauseReason', pause_reason
    )) returning * into existing;
  if refund > 0 then
    insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
      idempotency_key, credits, opptium_credits, currency)
    values(target_workspace_id, target_campaign_run_id, target_operation, 'release',
      target_idempotency_key || ':release', -refund, 0, 'USD');
  end if;
  return jsonb_build_object('id', existing.id, 'opptiumCredits',
    existing.opptium_credits, 'requestedOpptiumCredits', target_opptium_credits,
    'actualCostUsd', existing.actual_cost_usd,
    'billableCostUsd', existing.billable_cost_usd,
    'pauseReason', pause_reason, 'idempotent', false);
end; $$;

revoke all on function public.settle_research_credits(uuid,uuid,uuid,text,text,text,text,text,jsonb,numeric,numeric,numeric,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.settle_research_credits(uuid,uuid,uuid,text,text,text,text,text,jsonb,numeric,numeric,numeric,uuid,jsonb)
  to service_role;
