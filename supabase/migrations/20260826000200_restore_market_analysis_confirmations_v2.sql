-- The production ledger contains 20260824000400, but this relation was absent
-- after historical manual migration application. Restore the omitted artifact
-- boundary without replaying the rest of that migration.

create table if not exists public.market_analysis_confirmations_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  market_analysis_id uuid not null
    references public.market_analyses(id) on delete restrict,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  unique (market_analysis_id),
  unique (workspace_id, id)
);

alter table public.market_analysis_confirmations_v2 enable row level security;

drop policy if exists market_analysis_confirmations_v2_select
  on public.market_analysis_confirmations_v2;
create policy market_analysis_confirmations_v2_select
  on public.market_analysis_confirmations_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

drop policy if exists market_analysis_confirmations_v2_insert
  on public.market_analysis_confirmations_v2;
create policy market_analysis_confirmations_v2_insert
  on public.market_analysis_confirmations_v2 for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and confirmed_by = auth.uid()
    and exists (
      select 1 from public.market_analyses analysis
      where analysis.id = market_analysis_id
        and analysis.workspace_id = workspace_id
        and analysis.campaign_id = campaign_id
        and analysis.campaign_target_model_version_id is not null
    )
  );

drop trigger if exists market_analysis_confirmations_v2_immutable
  on public.market_analysis_confirmations_v2;
create trigger market_analysis_confirmations_v2_immutable
before update or delete on public.market_analysis_confirmations_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();

revoke all on public.market_analysis_confirmations_v2 from anon, authenticated;
grant select, insert on public.market_analysis_confirmations_v2 to authenticated;

