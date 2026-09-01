-- Deny reservations without rolling back the persisted pause reason.

create or replace function public.reserve_research_credits(
  target_workspace_id uuid, target_campaign_run_id uuid, target_operation text,
  target_idempotency_key text, target_estimated_credits numeric
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
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  if account.workspace_id is null then raise exception 'Workspace credit account not found.'; end if;
  select * into existing from public.budget_reservations
    where workspace_id = target_workspace_id and operation = target_operation
      and idempotency_key = target_idempotency_key;
  if existing.id is not null then
    if existing.campaign_run_id <> target_campaign_run_id
      or existing.reserved_credits <> target_estimated_credits
    then raise exception 'Idempotent reservation input changed.'; end if;
    return jsonb_build_object('id', existing.id, 'status', existing.status,
      'reservedCredits', existing.reserved_credits, 'granted', true);
  end if;
  select coalesce(sum(reserved_credits), 0) into active_reserved
    from public.budget_reservations where campaign_run_id = target_campaign_run_id
      and status = 'reserved';
  if target_run.research_credits_consumed + active_reserved + target_estimated_credits
      > target_run.research_credit_cap then
    update public.campaign_runs set research_pause_reason = 'campaign_budget'
      where id = target_run.id;
    return jsonb_build_object('granted', false, 'reason', 'campaign_budget',
      'message', 'Campaign research credit authorization exhausted.');
  end if;
  if target_estimated_credits > account.available_credits then
    update public.campaign_runs set research_pause_reason = 'workspace_balance'
      where id = target_run.id;
    return jsonb_build_object('granted', false, 'reason', 'workspace_balance',
      'message', 'Workspace credit balance exhausted.');
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
    'reservedCredits', existing.reserved_credits, 'granted', true);
end; $$;

revoke all on function public.reserve_research_credits(uuid,uuid,text,text,numeric)
  from public, anon, authenticated;
grant execute on function public.reserve_research_credits(uuid,uuid,text,text,numeric)
  to service_role;
