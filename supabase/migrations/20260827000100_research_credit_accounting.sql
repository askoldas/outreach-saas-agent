-- Provider-neutral Company Research credits, atomic reservations, and auditable usage.

create table public.workspace_credit_accounts (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  available_credits numeric(18, 6) not null default 0 check (available_credits >= 0),
  updated_at timestamptz not null default now()
);

-- Development/MVP grant is centralized here until checkout owns account funding.
insert into public.workspace_credit_accounts(workspace_id, available_credits)
select id, 120 from public.workspaces on conflict (workspace_id) do nothing;

create or replace function public.initialize_workspace_credit_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_credit_accounts(workspace_id, available_credits)
  values (new.id, 120) on conflict (workspace_id) do nothing;
  return new;
end; $$;
create trigger initialize_workspace_credit_account
after insert on public.workspaces for each row execute function public.initialize_workspace_credit_account();

alter table public.campaign_runs
  add column research_credit_cap numeric(18, 6) not null default 30
    check (research_credit_cap >= 0),
  add column research_credits_consumed numeric(18, 6) not null default 0
    check (research_credits_consumed >= 0),
  add column research_pause_reason text
    check (research_pause_reason is null or research_pause_reason in
      ('campaign_budget','workspace_balance','manual','saturation','completed'));

alter table public.budget_reservations
  add column reserved_credits numeric(18, 6) not null default 0
    check (reserved_credits >= 0),
  add column settled_credits numeric(18, 6)
    check (settled_credits is null or settled_credits >= 0);

alter table public.usage_ledger
  add column provider text,
  add column model text,
  add column provider_request_id text,
  add column company_id uuid references public.companies(id) on delete set null,
  add column raw_provider_usage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(raw_provider_usage) = 'object'),
  add column actual_cost_usd numeric(18, 8) not null default 0
    check (actual_cost_usd >= 0),
  add column billable_cost_usd numeric(18, 8) not null default 0
    check (billable_cost_usd >= 0),
  add column opptium_credits numeric(18, 6) not null default 0
    check (opptium_credits >= 0);

create unique index usage_ledger_provider_request_actual_idx
  on public.usage_ledger(workspace_id, provider, provider_request_id)
  where provider_request_id is not null and entry_type = 'settlement';
create index usage_ledger_campaign_provider_idx
  on public.usage_ledger(campaign_run_id, provider, created_at desc);
create index usage_ledger_company_idx
  on public.usage_ledger(company_id, created_at desc) where company_id is not null;

alter table public.workspace_credit_accounts enable row level security;
create policy workspace_credit_accounts_select
  on public.workspace_credit_accounts for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.get_research_budget_state(
  target_workspace_id uuid,
  target_campaign_run_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare workspace_balance numeric(18, 6);
declare reserved numeric(18, 6);
declare campaign_remaining numeric(18, 6);
begin
  if auth.role() <> 'service_role' and not public.is_workspace_member(target_workspace_id)
  then raise exception 'Forbidden'; end if;
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
  select coalesce(available_credits, 0) into workspace_balance
    from public.workspace_credit_accounts where workspace_id = target_workspace_id;
  workspace_balance := coalesce(workspace_balance, 0);
  select coalesce(sum(reserved_credits), 0) into reserved
    from public.budget_reservations where workspace_id = target_workspace_id
      and campaign_run_id = target_campaign_run_id and status = 'reserved';
  campaign_remaining := greatest(0,
    target_run.research_credit_cap - target_run.research_credits_consumed - reserved);
  return jsonb_build_object(
    'authorizedCredits', target_run.research_credit_cap,
    'consumedCredits', target_run.research_credits_consumed,
    'reservedCredits', reserved,
    'remainingCampaignCredits', campaign_remaining,
    'workspaceAvailableCredits', workspace_balance,
    'spendableCredits', least(campaign_remaining, workspace_balance)
  );
end; $$;

create or replace function public.reserve_research_credits(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_operation text,
  target_idempotency_key text,
  target_estimated_credits numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare account public.workspace_credit_accounts;
declare existing public.budget_reservations;
declare active_reserved numeric(18, 6);
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if target_estimated_credits <= 0 then raise exception 'Reservation must be positive.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-budget:' || target_workspace_id::text, 0));
  select * into target_run from public.campaign_runs where id = target_campaign_run_id
    and workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
  insert into public.workspace_credit_accounts(workspace_id, available_credits)
    values (target_workspace_id, 0) on conflict (workspace_id) do nothing;
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  select * into existing from public.budget_reservations
    where workspace_id = target_workspace_id and operation = target_operation
      and idempotency_key = target_idempotency_key;
  if existing.id is not null then
    if existing.campaign_run_id <> target_campaign_run_id
      or existing.reserved_credits <> target_estimated_credits
    then raise exception 'Idempotent reservation input changed.'; end if;
    return jsonb_build_object('id', existing.id, 'status', existing.status,
      'reservedCredits', existing.reserved_credits);
  end if;
  select coalesce(sum(reserved_credits), 0) into active_reserved
    from public.budget_reservations where campaign_run_id = target_campaign_run_id
      and status = 'reserved';
  if target_run.research_credits_consumed + active_reserved + target_estimated_credits
      > target_run.research_credit_cap then
    update public.campaign_runs set research_pause_reason = 'campaign_budget'
      where id = target_run.id;
    raise exception 'Campaign research credit authorization exhausted.';
  end if;
  if target_estimated_credits > account.available_credits then
    update public.campaign_runs set research_pause_reason = 'workspace_balance'
      where id = target_run.id;
    raise exception 'Workspace credit balance exhausted.';
  end if;
  update public.workspace_credit_accounts set
    available_credits = available_credits - target_estimated_credits, updated_at = now()
    where workspace_id = target_workspace_id;
  insert into public.budget_reservations(workspace_id, campaign_run_id, operation,
    idempotency_key, status, reserved_amount, reserved_credits, currency)
  values(target_workspace_id, target_campaign_run_id, target_operation,
    target_idempotency_key, 'reserved', 0, target_estimated_credits, 'USD')
  returning * into existing;
  insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
    idempotency_key, credits, opptium_credits, currency)
  values(target_workspace_id, target_campaign_run_id, target_operation, 'reservation',
    target_idempotency_key, target_estimated_credits, target_estimated_credits, 'USD');
  return jsonb_build_object('id', existing.id, 'status', existing.status,
    'reservedCredits', existing.reserved_credits);
end; $$;

create or replace function public.settle_research_credits(
  target_workspace_id uuid, target_campaign_run_id uuid, target_reservation_id uuid,
  target_idempotency_key text, target_provider text, target_operation text,
  target_model text, target_provider_request_id text, target_raw_usage jsonb,
  target_actual_cost_usd numeric, target_billable_cost_usd numeric,
  target_opptium_credits numeric, target_company_id uuid, target_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare reservation public.budget_reservations;
declare existing public.usage_ledger;
declare refund numeric(18, 6);
declare extra numeric(18, 6);
declare target_run public.campaign_runs;
declare account public.workspace_credit_accounts;
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
  extra := greatest(0, target_opptium_credits - reservation.reserved_credits);
  if extra > 0 then
    select * into target_run from public.campaign_runs where id = target_campaign_run_id for update;
    select * into account from public.workspace_credit_accounts where workspace_id = target_workspace_id for update;
    if target_run.research_credits_consumed + target_opptium_credits > target_run.research_credit_cap
    then raise exception 'Actual usage exceeds Campaign authorization.'; end if;
    if extra > account.available_credits then raise exception 'Actual usage exceeds Workspace balance.'; end if;
    update public.workspace_credit_accounts set available_credits = available_credits - extra,
      updated_at = now() where workspace_id = target_workspace_id;
  end if;
  refund := reservation.reserved_credits - target_opptium_credits;
  update public.budget_reservations set status = 'settled',
    settled_amount = target_billable_cost_usd, settled_credits = target_opptium_credits,
    settled_at = now() where id = reservation.id;
  update public.workspace_credit_accounts set available_credits = available_credits + refund,
    updated_at = now() where workspace_id = target_workspace_id;
  update public.campaign_runs set
    research_credits_consumed = research_credits_consumed + target_opptium_credits,
    research_pause_reason = null where id = target_campaign_run_id;
  insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
    idempotency_key, credits, amount, currency, provider, model, provider_request_id,
    company_id, raw_provider_usage, actual_cost_usd, billable_cost_usd,
    opptium_credits, metadata)
  values(target_workspace_id, target_campaign_run_id, target_operation, 'settlement',
    target_idempotency_key, target_opptium_credits, target_billable_cost_usd, 'USD',
    target_provider, target_model, target_provider_request_id, target_company_id,
    target_raw_usage, target_actual_cost_usd, target_billable_cost_usd,
    target_opptium_credits, target_metadata) returning * into existing;
  if refund > 0 then
    insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
      idempotency_key, credits, opptium_credits, currency)
    values(target_workspace_id, target_campaign_run_id, target_operation, 'release',
      target_idempotency_key || ':release', -refund, 0, 'USD');
  end if;
  return jsonb_build_object('id', existing.id, 'opptiumCredits',
    existing.opptium_credits, 'actualCostUsd', existing.actual_cost_usd,
    'billableCostUsd', existing.billable_cost_usd, 'idempotent', false);
end; $$;

revoke all on public.workspace_credit_accounts from anon, authenticated;
grant select on public.workspace_credit_accounts to authenticated;
revoke all on function public.get_research_budget_state(uuid, uuid) from public, anon;
grant execute on function public.get_research_budget_state(uuid, uuid) to authenticated, service_role;
revoke all on function public.reserve_research_credits(uuid,uuid,text,text,numeric) from public, anon, authenticated;
grant execute on function public.reserve_research_credits(uuid,uuid,text,text,numeric) to service_role;
revoke all on function public.settle_research_credits(uuid,uuid,uuid,text,text,text,text,text,jsonb,numeric,numeric,numeric,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.settle_research_credits(uuid,uuid,uuid,text,text,text,text,text,jsonb,numeric,numeric,numeric,uuid,jsonb) to service_role;
