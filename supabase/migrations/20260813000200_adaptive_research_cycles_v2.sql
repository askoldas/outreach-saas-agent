-- Immutable Campaign Research cycle decisions and bounded continuation history.

create table public.campaign_research_cycles_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  cycle_number integer not null check (cycle_number > 0),
  continuation_of_cycle_id uuid references public.campaign_research_cycles_v2(id) on delete restrict,
  status text not null check (status in ('running','complete','paused','cancelled')),
  budget_json jsonb not null check (jsonb_typeof(budget_json) = 'object'),
  usage_json jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_json) = 'object'),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_run_id, cycle_number),
  unique (workspace_id, id)
);

create table public.campaign_research_cycle_decisions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_cycle_id uuid not null references public.campaign_research_cycles_v2(id) on delete cascade,
  decision_number integer not null check (decision_number > 0),
  action text not null check (action in (
    'research_existing_pool','discover_more','expand_source_pages','stop_budget',
    'stop_saturation','stop_low_yield','stop_no_actionable_work','pause','cancel'
  )),
  reason_code text not null,
  rationale text not null,
  decision_json jsonb not null check (jsonb_typeof(decision_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (research_cycle_id, decision_number),
  unique (workspace_id, id)
);

create index campaign_research_cycles_v2_campaign_idx
  on public.campaign_research_cycles_v2(workspace_id, campaign_id, cycle_number desc);

alter table public.campaign_research_cycles_v2 enable row level security;
alter table public.campaign_research_cycle_decisions_v2 enable row level security;

create policy campaign_research_cycles_v2_select
  on public.campaign_research_cycles_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy campaign_research_cycle_decisions_v2_select
  on public.campaign_research_cycle_decisions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.ensure_campaign_research_cycle_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_cycle_number integer,
  target_budget jsonb,
  target_continuation_of_cycle_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare saved_cycle public.campaign_research_cycles_v2;
declare target_run public.campaign_runs;
begin
  if auth.role() <> 'service_role' and not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_cycle_number < 1 or jsonb_typeof(target_budget) <> 'object' then
    raise exception 'Invalid Campaign Research cycle input.';
  end if;
  select * into target_run from public.campaign_runs
  where id = target_campaign_run_id and workspace_id = target_workspace_id and workflow_version = 'v2';
  if target_run.id is null then raise exception 'V2 Campaign Run not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended('research-cycle:' || target_campaign_run_id::text || ':' || target_cycle_number::text, 0));
  insert into public.campaign_research_cycles_v2 (
    workspace_id, campaign_id, campaign_run_id, cycle_number,
    continuation_of_cycle_id, status, budget_json
  ) values (
    target_workspace_id, target_run.campaign_id, target_run.id, target_cycle_number,
    target_continuation_of_cycle_id, 'running', target_budget
  ) on conflict (campaign_run_id, cycle_number) do nothing;
  select * into saved_cycle from public.campaign_research_cycles_v2
  where campaign_run_id = target_campaign_run_id and cycle_number = target_cycle_number;
  if saved_cycle.budget_json <> target_budget then
    raise exception 'Campaign Research cycle budget changed after it was frozen.';
  end if;
  return jsonb_build_object(
    'id', saved_cycle.id, 'campaignRunId', saved_cycle.campaign_run_id,
    'cycleNumber', saved_cycle.cycle_number, 'status', saved_cycle.status,
    'budget', saved_cycle.budget_json, 'startedAt', saved_cycle.started_at
  );
end;
$$;

create or replace function public.finalize_campaign_research_cycle_v2(
  target_workspace_id uuid,
  target_cycle_id uuid,
  target_usage jsonb,
  target_decision jsonb
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare saved_cycle public.campaign_research_cycles_v2;
declare saved_decision public.campaign_research_cycle_decisions_v2;
declare final_status text;
begin
  if auth.role() <> 'service_role' and not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if jsonb_typeof(target_usage) <> 'object' or jsonb_typeof(target_decision) <> 'object' then
    raise exception 'Invalid Campaign Research decision input.';
  end if;
  select * into saved_cycle from public.campaign_research_cycles_v2
  where id = target_cycle_id and workspace_id = target_workspace_id for update;
  if saved_cycle.id is null then raise exception 'Campaign Research cycle not found.'; end if;
  select * into saved_decision from public.campaign_research_cycle_decisions_v2
  where research_cycle_id = saved_cycle.id and decision_number = 1;
  if saved_decision.id is not null then return saved_decision.decision_json; end if;
  final_status := case target_decision->>'action'
    when 'pause' then 'paused' when 'cancel' then 'cancelled' else 'complete' end;
  insert into public.campaign_research_cycle_decisions_v2 (
    workspace_id, research_cycle_id, decision_number, action,
    reason_code, rationale, decision_json
  ) values (
    target_workspace_id, saved_cycle.id, 1, target_decision->>'action',
    target_decision->>'reasonCode', target_decision->>'rationale', target_decision
  ) returning * into saved_decision;
  update public.campaign_research_cycles_v2 set
    status = final_status, usage_json = target_usage, completed_at = now()
  where id = saved_cycle.id;
  return saved_decision.decision_json;
end;
$$;

revoke all on function public.ensure_campaign_research_cycle_v2(uuid,uuid,integer,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.finalize_campaign_research_cycle_v2(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ensure_campaign_research_cycle_v2(uuid,uuid,integer,jsonb,uuid) to service_role;
grant execute on function public.finalize_campaign_research_cycle_v2(uuid,uuid,jsonb,jsonb) to service_role;
