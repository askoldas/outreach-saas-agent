-- Versioned boundaries for the organization-first core intelligence pipeline.
-- This migration preserves historical Strategy, Market Analysis, and workflow records.

create table public.commercial_intelligence_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_version_id uuid not null
    references public.company_profile_versions(id) on delete restrict,
  version integer not null check (version > 0),
  intelligence_json jsonb not null check (jsonb_typeof(intelligence_json) = 'object'),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  prompt_version text,
  model_role text,
  provider text,
  model text,
  evidence_ids text[] not null default '{}',
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (company_profile_version_id, version),
  unique (workspace_id, company_profile_version_id, input_hash, schema_version, compiler_version),
  unique (workspace_id, id)
);

create table public.campaign_target_model_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  profile_snapshot_id uuid not null
    references public.campaign_profile_snapshots(id) on delete restrict,
  commercial_intelligence_version_id uuid not null
    references public.commercial_intelligence_versions_v2(id) on delete restrict,
  version integer not null check (version > 0),
  target_model_json jsonb not null check (jsonb_typeof(target_model_json) = 'object'),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  evidence_ids text[] not null default '{}',
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (workspace_id, campaign_id, input_hash, schema_version, compiler_version),
  unique (workspace_id, id)
);

alter table public.market_analyses
  add column if not exists profile_snapshot_id uuid
    references public.campaign_profile_snapshots(id) on delete restrict,
  add column if not exists commercial_intelligence_version_id uuid
    references public.commercial_intelligence_versions_v2(id) on delete restrict,
  add column if not exists campaign_target_model_version_id uuid
    references public.campaign_target_model_versions_v2(id) on delete restrict,
  add column if not exists campaign_strategy_version_id uuid
    references public.campaign_strategy_versions(id) on delete restrict,
  add column if not exists input_hash text check (input_hash is null or length(input_hash) = 64),
  add column if not exists content_hash text check (content_hash is null or length(content_hash) = 64),
  add column if not exists schema_version text,
  add column if not exists compiler_version text,
  add column if not exists model_role text,
  add column if not exists evidence_ids text[] not null default '{}',
  add column if not exists requires_user_confirmation boolean not null default false,
  add column if not exists supersedes_market_analysis_id uuid
    references public.market_analyses(id) on delete restrict;

create unique index market_analyses_v2_cache_idx
  on public.market_analyses(
    workspace_id, campaign_id, campaign_target_model_version_id,
    input_hash, schema_version, compiler_version
  )
  where campaign_target_model_version_id is not null and input_hash is not null;

create table public.market_analysis_confirmations_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  market_analysis_id uuid not null references public.market_analyses(id) on delete restrict,
  confirmed_by uuid not null references auth.users(id) on delete restrict,
  confirmed_at timestamptz not null default now(),
  unique (market_analysis_id),
  unique (workspace_id, id)
);

create table public.market_research_plan_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete restrict,
  market_analysis_id uuid not null references public.market_analyses(id) on delete restrict,
  campaign_target_model_version_id uuid not null
    references public.campaign_target_model_versions_v2(id) on delete restrict,
  version integer not null check (version > 0),
  plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  provider_capability_snapshot_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (workspace_id, campaign_id, input_hash, schema_version, compiler_version),
  unique (workspace_id, id)
);

create table public.research_blueprint_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_target_model_version_id uuid not null
    references public.campaign_target_model_versions_v2(id) on delete restrict,
  market_analysis_id uuid not null references public.market_analyses(id) on delete restrict,
  target_archetype_id text not null,
  version integer not null check (version > 0),
  blueprint_json jsonb not null check (jsonb_typeof(blueprint_json) = 'object'),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  created_at timestamptz not null default now(),
  unique (campaign_id, target_archetype_id, version),
  unique (
    workspace_id, campaign_id, target_archetype_id,
    input_hash, schema_version, compiler_version
  ),
  unique (workspace_id, id)
);

create index commercial_intelligence_versions_v2_profile_idx
  on public.commercial_intelligence_versions_v2(workspace_id, company_profile_version_id, version desc);
create index campaign_target_model_versions_v2_campaign_idx
  on public.campaign_target_model_versions_v2(workspace_id, campaign_id, version desc);
create index market_research_plan_versions_v2_campaign_idx
  on public.market_research_plan_versions_v2(workspace_id, campaign_id, version desc);
create index research_blueprint_versions_v2_campaign_idx
  on public.research_blueprint_versions_v2(workspace_id, campaign_id, target_archetype_id, version desc);

alter table public.commercial_intelligence_versions_v2 enable row level security;
alter table public.campaign_target_model_versions_v2 enable row level security;
alter table public.market_research_plan_versions_v2 enable row level security;
alter table public.research_blueprint_versions_v2 enable row level security;
alter table public.market_analysis_confirmations_v2 enable row level security;

create policy commercial_intelligence_versions_v2_select
  on public.commercial_intelligence_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy campaign_target_model_versions_v2_select
  on public.campaign_target_model_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy market_research_plan_versions_v2_select
  on public.market_research_plan_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy research_blueprint_versions_v2_select
  on public.research_blueprint_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
create policy market_analysis_confirmations_v2_select
  on public.market_analysis_confirmations_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));
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

create or replace function public.assert_core_intelligence_artifact_workspace_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'commercial_intelligence_versions_v2' then
    if not exists (
      select 1 from public.company_profile_versions profile
      where profile.id = new.company_profile_version_id
        and profile.workspace_id = new.workspace_id
    ) then raise exception 'Commercial Intelligence profile workspace mismatch.'; end if;
  elsif tg_table_name = 'campaign_target_model_versions_v2' then
    if not exists (
      select 1 from public.campaigns campaign
      join public.campaign_profile_snapshots snapshot
        on snapshot.id = new.profile_snapshot_id
       and snapshot.campaign_id = campaign.id
       and snapshot.workspace_id = campaign.workspace_id
      join public.commercial_intelligence_versions_v2 commercial
        on commercial.id = new.commercial_intelligence_version_id
       and commercial.workspace_id = campaign.workspace_id
      where campaign.id = new.campaign_id and campaign.workspace_id = new.workspace_id
    ) then raise exception 'Campaign Target Model workspace or Campaign mismatch.'; end if;
  elsif tg_table_name = 'market_analyses' and new.campaign_target_model_version_id is not null then
    if auth.role() <> 'service_role' then
      raise exception 'V2 Market Analysis writes require the service role.';
    end if;
    if not exists (
      select 1 from public.campaign_target_model_versions_v2 target
      where target.id = new.campaign_target_model_version_id
        and target.campaign_id = new.campaign_id and target.workspace_id = new.workspace_id
    ) then raise exception 'Market Analysis target-model mismatch.'; end if;
  elsif tg_table_name = 'market_research_plan_versions_v2' then
    if not exists (
      select 1 from public.market_analyses analysis
      join public.campaign_target_model_versions_v2 target
        on target.id = new.campaign_target_model_version_id
       and target.campaign_id = analysis.campaign_id
       and target.workspace_id = analysis.workspace_id
      where analysis.id = new.market_analysis_id
        and analysis.campaign_id = new.campaign_id and analysis.workspace_id = new.workspace_id
    ) then raise exception 'Market Research Plan artifact mismatch.'; end if;
  elsif tg_table_name = 'research_blueprint_versions_v2' then
    if not exists (
      select 1 from public.market_analyses analysis
      join public.campaign_target_model_versions_v2 target
        on target.id = new.campaign_target_model_version_id
       and target.campaign_id = analysis.campaign_id
       and target.workspace_id = analysis.workspace_id
      where analysis.id = new.market_analysis_id
        and analysis.campaign_id = new.campaign_id and analysis.workspace_id = new.workspace_id
    ) then raise exception 'Research Blueprint artifact mismatch.'; end if;
  end if;
  return new;
end;
$$;

create trigger commercial_intelligence_versions_v2_workspace_guard
before insert on public.commercial_intelligence_versions_v2
for each row execute function public.assert_core_intelligence_artifact_workspace_v2();
create trigger campaign_target_model_versions_v2_workspace_guard
before insert on public.campaign_target_model_versions_v2
for each row execute function public.assert_core_intelligence_artifact_workspace_v2();
create trigger market_analyses_v2_workspace_guard
before insert or update of campaign_target_model_version_id on public.market_analyses
for each row execute function public.assert_core_intelligence_artifact_workspace_v2();
create trigger market_research_plan_versions_v2_workspace_guard
before insert on public.market_research_plan_versions_v2
for each row execute function public.assert_core_intelligence_artifact_workspace_v2();
create trigger research_blueprint_versions_v2_workspace_guard
before insert on public.research_blueprint_versions_v2
for each row execute function public.assert_core_intelligence_artifact_workspace_v2();

create or replace function public.reject_core_intelligence_artifact_mutation_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Core Intelligence artifact versions are immutable.';
end;
$$;

create trigger commercial_intelligence_versions_v2_immutable
before update or delete on public.commercial_intelligence_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();
create trigger campaign_target_model_versions_v2_immutable
before update or delete on public.campaign_target_model_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();
create trigger market_research_plan_versions_v2_immutable
before update or delete on public.market_research_plan_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();
create trigger research_blueprint_versions_v2_immutable
before update or delete on public.research_blueprint_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();
create trigger market_analysis_confirmations_v2_immutable
before update or delete on public.market_analysis_confirmations_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();

create or replace function public.reject_v2_market_analysis_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.campaign_target_model_version_id is not null then
    raise exception 'V2 Market Analysis versions are immutable.';
  end if;
  return old;
end;
$$;

create trigger market_analyses_v2_immutable
before update or delete on public.market_analyses
for each row execute function public.reject_v2_market_analysis_mutation();

revoke all on public.commercial_intelligence_versions_v2 from anon, authenticated;
revoke all on public.campaign_target_model_versions_v2 from anon, authenticated;
revoke all on public.market_research_plan_versions_v2 from anon, authenticated;
revoke all on public.research_blueprint_versions_v2 from anon, authenticated;
grant select on public.commercial_intelligence_versions_v2 to authenticated;
grant select on public.campaign_target_model_versions_v2 to authenticated;
grant select on public.market_research_plan_versions_v2 to authenticated;
grant select on public.research_blueprint_versions_v2 to authenticated;
revoke all on public.market_analysis_confirmations_v2 from anon, authenticated;
grant select, insert on public.market_analysis_confirmations_v2 to authenticated;
