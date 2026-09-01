create table public.contact_enrichment_credit_authorizations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  reservation_id uuid not null references public.budget_reservations(id) on delete restrict,
  idempotency_key text not null,
  authorized_credits numeric(18, 6) not null check (authorized_credits > 0),
  consumed_credits numeric(18, 6) not null default 0 check (consumed_credits >= 0),
  status text not null default 'reserved' check (status in ('reserved','settled','released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (workspace_id, idempotency_key)
);

alter table public.contact_enrichment_credit_authorizations enable row level security;
create policy contact_enrichment_credit_authorizations_select
  on public.contact_enrichment_credit_authorizations for select to authenticated
  using (public.is_workspace_member(workspace_id));
revoke all on public.contact_enrichment_credit_authorizations from anon, authenticated;
grant select on public.contact_enrichment_credit_authorizations to authenticated;

create or replace function public.authorize_contact_enrichment_credits(
  target_workspace_id uuid, target_campaign_run_id uuid,
  target_campaign_company_id uuid, target_idempotency_key text,
  target_max_credits numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare existing public.contact_enrichment_credit_authorizations;
declare account public.workspace_credit_accounts;
declare reservation public.budget_reservations;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if target_max_credits <= 0 then raise exception 'Contact authorization must be positive.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('contact-budget:' || target_workspace_id::text, 0));
  select * into existing from public.contact_enrichment_credit_authorizations
    where workspace_id = target_workspace_id and idempotency_key = target_idempotency_key;
  if existing.id is not null then
    if existing.campaign_run_id <> target_campaign_run_id
      or existing.campaign_company_id <> target_campaign_company_id
      or existing.authorized_credits <> target_max_credits
    then raise exception 'Idempotent contact authorization input changed.'; end if;
    return jsonb_build_object('id', existing.id, 'reservationId', existing.reservation_id,
      'authorizedCredits', existing.authorized_credits, 'status', existing.status);
  end if;
  if not exists(select 1 from public.campaign_runs run
    join public.campaign_companies company on company.campaign_id = run.campaign_id
    where run.id = target_campaign_run_id and run.workspace_id = target_workspace_id
      and company.id = target_campaign_company_id and company.workspace_id = target_workspace_id)
  then raise exception 'Contact enrichment target does not belong to the Campaign Run.'; end if;
  select * into account from public.workspace_credit_accounts
    where workspace_id = target_workspace_id for update;
  if account.workspace_id is null then raise exception 'Workspace credit account not found.'; end if;
  if account.available_credits < target_max_credits
  then raise exception 'Workspace credit balance is insufficient for Contact Enrichment.'; end if;
  update public.workspace_credit_accounts set
    available_credits = available_credits - target_max_credits, updated_at = now()
    where workspace_id = target_workspace_id;
  insert into public.budget_reservations(workspace_id,campaign_run_id,operation,
    idempotency_key,status,reserved_amount,reserved_credits,currency)
  values(target_workspace_id,target_campaign_run_id,'contact_enrichment',
    target_idempotency_key,'reserved',0,target_max_credits,'USD') returning * into reservation;
  insert into public.contact_enrichment_credit_authorizations(workspace_id,
    campaign_run_id,campaign_company_id,reservation_id,idempotency_key,authorized_credits)
  values(target_workspace_id,target_campaign_run_id,target_campaign_company_id,
    reservation.id,target_idempotency_key,target_max_credits) returning * into existing;
  insert into public.usage_ledger(workspace_id,campaign_run_id,operation,entry_type,
    idempotency_key,credits,opptium_credits,currency,metadata)
  values(target_workspace_id,target_campaign_run_id,'contact_enrichment','reservation',
    target_idempotency_key,target_max_credits,target_max_credits,'USD',
    jsonb_build_object('authorizationId', existing.id,
      'campaignCompanyId', target_campaign_company_id));
  return jsonb_build_object('id', existing.id, 'reservationId', reservation.id,
    'authorizedCredits', existing.authorized_credits, 'status', existing.status);
end; $$;

create or replace function public.settle_contact_enrichment_credits(
  target_workspace_id uuid, target_authorization_id uuid,
  target_idempotency_key text, target_provider_request_id text,
  target_raw_usage jsonb, target_actual_cost_usd numeric,
  target_billable_cost_usd numeric, target_opptium_credits numeric,
  target_metadata jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare contact_auth public.contact_enrichment_credit_authorizations;
declare existing public.usage_ledger;
declare charged numeric(18, 6);
declare refund numeric(18, 6);
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if least(target_actual_cost_usd,target_billable_cost_usd,target_opptium_credits) < 0
  then raise exception 'Usage values cannot be negative.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('contact-budget:' || target_workspace_id::text, 0));
  select * into existing from public.usage_ledger where workspace_id = target_workspace_id
    and entry_type = 'settlement' and idempotency_key = target_idempotency_key;
  if existing.id is not null then return jsonb_build_object('id',existing.id,
    'opptiumCredits',existing.opptium_credits,'idempotent',true); end if;
  select * into contact_auth from public.contact_enrichment_credit_authorizations
    where id = target_authorization_id and workspace_id = target_workspace_id for update;
  if contact_auth.id is null or contact_auth.status <> 'reserved'
  then raise exception 'Active Contact Enrichment authorization not found.'; end if;
  charged := least(target_opptium_credits, contact_auth.authorized_credits);
  refund := contact_auth.authorized_credits - charged;
  update public.contact_enrichment_credit_authorizations set status = 'settled',
    consumed_credits = charged, settled_at = now() where id = contact_auth.id;
  update public.budget_reservations set status = 'settled',
    settled_amount = target_billable_cost_usd, settled_credits = charged,
    settled_at = now() where id = contact_auth.reservation_id;
  update public.workspace_credit_accounts set available_credits = available_credits + refund,
    updated_at = now() where workspace_id = target_workspace_id;
  insert into public.usage_ledger(workspace_id,campaign_run_id,operation,entry_type,
    idempotency_key,credits,amount,currency,provider,provider_request_id,
    raw_provider_usage,actual_cost_usd,billable_cost_usd,opptium_credits,metadata)
  values(target_workspace_id,contact_auth.campaign_run_id,'contact_enrichment','settlement',
    target_idempotency_key,charged,target_billable_cost_usd,'USD','tavily',
    target_provider_request_id,target_raw_usage,target_actual_cost_usd,
    target_billable_cost_usd,charged,coalesce(target_metadata,'{}'::jsonb) ||
    jsonb_build_object('authorizationId',contact_auth.id,
      'campaignCompanyId',contact_auth.campaign_company_id,
      'unchargedOverageCredits',target_opptium_credits-charged)) returning * into existing;
  if refund > 0 then insert into public.usage_ledger(workspace_id,campaign_run_id,
    operation,entry_type,idempotency_key,credits,opptium_credits,currency)
    values(target_workspace_id,contact_auth.campaign_run_id,'contact_enrichment','release',
      target_idempotency_key || ':release',-refund,0,'USD'); end if;
  return jsonb_build_object('id',existing.id,'opptiumCredits',charged,
    'refundedCredits',refund,'idempotent',false);
end; $$;

create or replace function public.release_contact_enrichment_credits(
  target_workspace_id uuid, target_authorization_id uuid,
  target_idempotency_key text, target_reason text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare contact_auth public.contact_enrichment_credit_authorizations;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('contact-budget:' || target_workspace_id::text, 0));
  select * into contact_auth from public.contact_enrichment_credit_authorizations
    where id = target_authorization_id and workspace_id = target_workspace_id for update;
  if contact_auth.id is null then raise exception 'Contact authorization not found.'; end if;
  if contact_auth.status <> 'reserved' then return jsonb_build_object('id',contact_auth.id,
    'status',contact_auth.status,'idempotent',true); end if;
  update public.contact_enrichment_credit_authorizations set status = 'released',
    settled_at = now() where id = contact_auth.id;
  update public.budget_reservations set status = 'released', settled_at = now()
    where id = contact_auth.reservation_id and status = 'reserved';
  update public.workspace_credit_accounts set
    available_credits = available_credits + contact_auth.authorized_credits,
    updated_at = now() where workspace_id = target_workspace_id;
  insert into public.usage_ledger(workspace_id,campaign_run_id,operation,entry_type,
    idempotency_key,credits,opptium_credits,currency,metadata)
  values(target_workspace_id,contact_auth.campaign_run_id,'contact_enrichment','release',
    target_idempotency_key || ':release',-contact_auth.authorized_credits,0,'USD',
    jsonb_build_object('authorizationId',contact_auth.id,'reason',target_reason))
  on conflict(workspace_id,entry_type,idempotency_key) do nothing;
  return jsonb_build_object('id',contact_auth.id,'status','released','idempotent',false);
end; $$;

revoke all on function public.authorize_contact_enrichment_credits(uuid,uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.authorize_contact_enrichment_credits(uuid,uuid,uuid,text,numeric) to service_role;
revoke all on function public.settle_contact_enrichment_credits(uuid,uuid,text,text,jsonb,numeric,numeric,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.settle_contact_enrichment_credits(uuid,uuid,text,text,jsonb,numeric,numeric,numeric,jsonb) to service_role;
revoke all on function public.release_contact_enrichment_credits(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.release_contact_enrichment_credits(uuid,uuid,text,text) to service_role;
