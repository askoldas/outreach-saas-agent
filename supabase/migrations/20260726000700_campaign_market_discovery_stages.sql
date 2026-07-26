alter table public.campaign_runs
  add column if not exists candidates_discovered integer not null default 0 check (candidates_discovered >= 0),
  add column if not exists candidates_unique integer not null default 0 check (candidates_unique >= 0),
  add column if not exists candidates_classified integer not null default 0 check (candidates_classified >= 0),
  add column if not exists companies_evaluated integer not null default 0 check (companies_evaluated >= 0);

create table public.campaign_briefs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  profile_version_id uuid not null references public.company_profile_versions(id) on delete restrict,
  proposal jsonb not null check (jsonb_typeof(proposal) = 'object'),
  confirmed_brief jsonb not null check (jsonb_typeof(confirmed_brief) = 'object'),
  clarification_answer jsonb,
  prompt_version text not null,
  requested_model text not null,
  actual_model text not null,
  fallback_used boolean not null default false,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id),
  unique (workspace_id, id)
);

create table public.market_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  version integer not null check (version > 0),
  analysis jsonb not null check (jsonb_typeof(analysis) = 'object'),
  prompt_version text not null,
  requested_model text not null,
  actual_model text not null,
  fallback_used boolean not null default false,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (campaign_run_id, version),
  unique (workspace_id, id)
);

create table public.discovery_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  market_analysis_id uuid not null references public.market_analyses(id) on delete restrict,
  version integer not null check (version > 0),
  strategy_summary text not null,
  stop_conditions jsonb not null check (jsonb_typeof(stop_conditions) = 'object'),
  prompt_version text not null,
  requested_model text not null,
  actual_model text not null,
  fallback_used boolean not null default false,
  created_at timestamptz not null default now(),
  unique (campaign_run_id, version),
  unique (workspace_id, id)
);

create table public.discovery_paths (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_plan_id uuid not null references public.discovery_plans(id) on delete cascade,
  external_id text not null,
  path_type text not null check (path_type in (
    'direct_search', 'local_language_search', 'industry_terminology', 'directory',
    'association', 'event_exhibitors', 'partner_directory', 'adjacent_category'
  )),
  rationale text not null,
  expected_company_category text not null,
  priority integer not null check (priority > 0),
  queries text[] not null default '{}',
  source_hints text[] not null default '{}',
  expected_yield text check (expected_yield in ('low', 'medium', 'high')),
  max_results integer not null check (max_results between 1 and 50),
  unique (discovery_plan_id, external_id),
  unique (workspace_id, id)
);

create table public.discovery_iterations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  discovery_plan_id uuid not null references public.discovery_plans(id) on delete restrict,
  iteration_number integer not null check (iteration_number between 1 and 5),
  objective text not null,
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object'),
  decision text check (decision in (
    'continue', 'refine_queries', 'broaden', 'narrow', 'market_exhausted',
    'target_reached', 'budget_reached', 'paused'
  )),
  decision_reason text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_run_id, iteration_number),
  unique (workspace_id, id)
);

create table public.discovery_queries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  discovery_iteration_id uuid not null references public.discovery_iterations(id) on delete cascade,
  discovery_path_id uuid not null references public.discovery_paths(id) on delete restrict,
  query text not null,
  source_type text not null,
  result_limit integer not null check (result_limit between 1 and 50),
  provider text not null,
  provider_request_id text,
  retrieved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (discovery_iteration_id, discovery_path_id, query),
  unique (workspace_id, id)
);

create table public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  discovery_iteration_id uuid not null references public.discovery_iterations(id) on delete cascade,
  discovery_query_id uuid not null references public.discovery_queries(id) on delete restrict,
  company_name text not null,
  normalized_domain text,
  source_url text not null,
  source_type text not null,
  source_query text not null,
  source_path text not null,
  snippet text not null default '',
  country_region text,
  probable_category text,
  discovery_confidence numeric(5,4) check (discovery_confidence between 0 and 1),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.candidate_classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  candidate_id uuid not null references public.discovery_candidates(id) on delete cascade,
  status text not null check (status in (
    'promising', 'possible', 'unlikely', 'excluded', 'duplicate', 'insufficient_data'
  )),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  probable_category text,
  geography_match boolean,
  exclusion_reason text,
  reasons text[] not null default '{}',
  should_evaluate boolean not null,
  model_role text,
  prompt_version text,
  requested_model text,
  actual_model text,
  input_hash text not null,
  created_at timestamptz not null default now(),
  unique (candidate_id, input_hash),
  unique (workspace_id, id)
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'campaign_briefs', 'market_analyses', 'discovery_plans', 'discovery_paths',
    'discovery_iterations', 'discovery_queries', 'discovery_candidates',
    'candidate_classifications'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      'Admins can manage ' || table_name, table_name
    );
  end loop;
end;
$$;

create index market_analyses_run_version_idx on public.market_analyses(campaign_run_id, version desc);
create index discovery_paths_plan_priority_idx on public.discovery_paths(discovery_plan_id, priority);
create index discovery_candidates_run_created_idx on public.discovery_candidates(campaign_run_id, created_at);
create index candidate_classifications_run_status_idx on public.candidate_classifications(campaign_run_id, status);
