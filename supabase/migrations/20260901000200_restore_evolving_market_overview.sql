-- Restore the evolving Market Overview boundary in databases whose migration
-- history and physical schema drifted apart. This repair is intentionally
-- idempotent and supersedes the assumptions in 20260827000300.

create table if not exists public.research_market_overview_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  research_cycle_id uuid not null references public.campaign_research_cycles_v2(id) on delete cascade,
  cycle_number integer not null check (cycle_number > 0),
  overview_json jsonb not null check (jsonb_typeof(overview_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (campaign_run_id, cycle_number),
  unique (workspace_id, id)
);

create index if not exists research_market_overview_latest_idx
  on public.research_market_overview_versions(
    workspace_id,
    campaign_run_id,
    cycle_number desc
  );

alter table public.research_market_overview_versions enable row level security;
drop policy if exists research_market_overview_versions_select
  on public.research_market_overview_versions;
create policy research_market_overview_versions_select
  on public.research_market_overview_versions for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.persist_research_market_overview(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_research_cycle_id uuid,
  target_cycle_number integer,
  target_overview jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_run public.campaign_runs;
  target_cycle public.campaign_research_cycles_v2;
  saved public.research_market_overview_versions;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required';
  end if;
  select * into target_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id;
  select * into target_cycle
  from public.campaign_research_cycles_v2
  where id = target_research_cycle_id
    and campaign_run_id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and cycle_number = target_cycle_number;
  if target_run.id is null or target_cycle.id is null then
    raise exception 'Company Research overview context mismatch.';
  end if;
  insert into public.research_market_overview_versions(
    workspace_id,
    campaign_id,
    campaign_run_id,
    research_cycle_id,
    cycle_number,
    overview_json
  ) values (
    target_workspace_id,
    target_run.campaign_id,
    target_run.id,
    target_cycle.id,
    target_cycle_number,
    target_overview
  )
  on conflict (campaign_run_id, cycle_number) do update
    set overview_json = excluded.overview_json
    where research_market_overview_versions.overview_json = excluded.overview_json
  returning * into saved;
  if saved.id is null then
    raise exception 'Market Overview retry changed frozen cycle output.';
  end if;
  return saved.overview_json;
end;
$$;

create or replace function public.get_latest_research_market_overview(
  target_workspace_id uuid,
  target_campaign_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.research_market_overview_versions;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_member(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  select * into saved
  from public.research_market_overview_versions
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
  order by cycle_number desc
  limit 1;
  return saved.overview_json;
end;
$$;

revoke all on public.research_market_overview_versions from anon, authenticated;
grant select on public.research_market_overview_versions to authenticated;
revoke all on function
  public.persist_research_market_overview(uuid, uuid, uuid, integer, jsonb)
from public, anon, authenticated;
grant execute on function
  public.persist_research_market_overview(uuid, uuid, uuid, integer, jsonb)
to service_role;
revoke all on function
  public.get_latest_research_market_overview(uuid, uuid)
from public, anon;
grant execute on function
  public.get_latest_research_market_overview(uuid, uuid)
to authenticated, service_role;

notify pgrst, 'reload schema';

