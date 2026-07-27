create table public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.company_profile_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  version integer not null check (version > 0),
  company_name text not null default '',
  website_url text,
  summary text not null default '',
  structured_profile jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_profile) = 'object'),
  extracted_facts jsonb not null default '[]'::jsonb check (jsonb_typeof(extracted_facts) = 'array'),
  review_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(review_questions) = 'array'),
  profile_status text not null default 'draft' check (profile_status in ('draft', 'needs_input', 'ready', 'published')),
  readiness_score integer not null default 0 check (readiness_score between 0 and 100),
  provenance text not null default 'manual' check (provenance in ('workspace', 'manual', 'website_analysis', 'import')),
  analysis_prompt_version text,
  analysis_model_config_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_profile_id, version),
  unique (workspace_id, id)
);

alter table public.company_profiles
  add constraint company_profiles_current_version_fk
  foreign key (current_version_id) references public.company_profile_versions(id) on delete restrict;

create table public.campaign_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null,
  company_profile_version_id uuid not null references public.company_profile_versions(id) on delete restrict,
  snapshot_data jsonb not null check (jsonb_typeof(snapshot_data) = 'object'),
  created_at timestamptz not null default now(),
  unique (campaign_id),
  unique (workspace_id, id)
);

