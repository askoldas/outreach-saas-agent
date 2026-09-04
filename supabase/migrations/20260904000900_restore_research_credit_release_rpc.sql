-- Restore the failed-provider reservation release RPC for environments whose
-- migration ledger predates or skipped the original definition.
create or replace function public.release_research_credit_reservation(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_reservation_id uuid,
  target_idempotency_key text,
  target_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare reservation public.budget_reservations;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-budget:' || target_workspace_id::text, 0));
  select * into reservation from public.budget_reservations
    where id = target_reservation_id and workspace_id = target_workspace_id
      and campaign_run_id = target_campaign_run_id for update;
  if reservation.id is null then raise exception 'Credit reservation not found.'; end if;
  if reservation.status <> 'reserved' then
    return jsonb_build_object('id', reservation.id, 'status', reservation.status, 'idempotent', true);
  end if;
  update public.budget_reservations set status = 'released', settled_at = now()
    where id = reservation.id;
  update public.workspace_credit_accounts set
    available_credits = available_credits + reservation.reserved_credits,
    updated_at = now() where workspace_id = target_workspace_id;
  insert into public.usage_ledger(workspace_id, campaign_run_id, operation, entry_type,
    idempotency_key, credits, opptium_credits, currency, metadata)
  values(target_workspace_id, target_campaign_run_id, reservation.operation, 'release',
    target_idempotency_key || ':failed-release', -reservation.reserved_credits, 0,
    reservation.currency, jsonb_build_object('reason', left(target_reason, 500)))
  on conflict (workspace_id, entry_type, idempotency_key) do nothing;
  return jsonb_build_object('id', reservation.id, 'status', 'released', 'idempotent', false);
end; $$;

revoke all on function public.release_research_credit_reservation(uuid,uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.release_research_credit_reservation(uuid,uuid,uuid,text,text)
  to service_role;
