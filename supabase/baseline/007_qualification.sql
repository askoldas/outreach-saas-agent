create table public.qualification_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  status text not null check (status in ('highly_relevant', 'qualified', 'possible', 'insufficient_evidence', 'not_relevant', 'excluded')),
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  summary text not null,
  relationship_hypothesis text not null default '',
  recommended_roles text[] not null default '{}',
  positive_signals text[] not null default '{}',
  negative_signals text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  schema_version text not null,
  prompt_version text not null,
  model_config_id uuid,
  input_hash text not null,
  created_at timestamptz not null default now(),
  unique (campaign_company_id, input_hash)
);

create table public.qualification_dimensions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  qualification_result_id uuid not null references public.qualification_results(id) on delete cascade,
  criterion text not null,
  score integer not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  explanation text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (qualification_result_id, criterion)
);

create table public.qualification_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  qualification_result_id uuid not null references public.qualification_results(id) on delete cascade,
  criterion text not null,
  evidence_kind text not null check (evidence_kind in ('fact', 'inference', 'unknown', 'conflict')),
  statement text not null,
  source_url text,
  source_id uuid references public.company_sources(id) on delete set null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

