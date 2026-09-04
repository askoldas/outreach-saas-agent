-- Durable, run-scoped external market reconnaissance. This remains separate from
-- candidate discovery provider records because it informs where to search rather
-- than representing discovered organizations.

create table public.market_research_executions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_target_model_version_id uuid not null
    references public.campaign_target_model_versions_v2(id) on delete cascade,
  request_hash text not null check (length(request_hash) = 64),
  corpus_json jsonb not null check (jsonb_typeof(corpus_json) = 'object'),
  provider text not null check (provider in ('tavily')),
  provider_request_ids text[] not null default '{}',
  provider_credits numeric not null default 0 check (provider_credits >= 0),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  created_at timestamptz not null default now(),
  unique (workspace_id, campaign_run_id, request_hash),
  unique (workspace_id, id)
);

create index market_research_executions_v2_run_idx
  on public.market_research_executions_v2(workspace_id, campaign_run_id, created_at desc);

alter table public.market_research_executions_v2 enable row level security;

create policy market_research_executions_v2_select
  on public.market_research_executions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.assert_market_research_execution_scope_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Market Research execution writes require the service role.';
  end if;
  if not exists (
    select 1
    from public.campaign_runs run
    join public.campaigns campaign
      on campaign.id = run.campaign_id
     and campaign.workspace_id = run.workspace_id
    join public.campaign_target_model_versions_v2 target
      on target.id = new.campaign_target_model_version_id
     and target.campaign_id = campaign.id
     and target.workspace_id = campaign.workspace_id
    where run.id = new.campaign_run_id
      and run.workspace_id = new.workspace_id
      and campaign.id = new.campaign_id
  ) then
    raise exception 'Market Research execution scope mismatch.';
  end if;
  return new;
end;
$$;

create trigger market_research_executions_v2_scope_guard
before insert on public.market_research_executions_v2
for each row execute function public.assert_market_research_execution_scope_v2();

create trigger market_research_executions_v2_immutable
before update on public.market_research_executions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();

revoke all on public.market_research_executions_v2 from anon, authenticated;
grant select on public.market_research_executions_v2 to authenticated;
