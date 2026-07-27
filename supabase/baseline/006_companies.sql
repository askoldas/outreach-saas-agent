create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  normalized_name text not null,
  website_url text,
  country text,
  city text,
  industry text,
  company_type text,
  estimated_size text,
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.company_domains (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  domain text not null,
  normalized_domain text not null,
  is_primary boolean not null default false,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'source_confirmed', 'verified', 'disputed')),
  collision_status text not null default 'clear' check (collision_status in ('clear', 'ambiguous', 'manual_review', 'resolved')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, normalized_domain)
);

create table public.company_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider text not null,
  source_type text not null,
  query text,
  title text not null default '',
  source_url text not null,
  original_url text not null,
  retrieved_at timestamptz not null default now(),
  excerpt text not null default '',
  raw_content text,
  provider_reference text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (workspace_id, provider, source_url)
);

create table public.campaign_companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'discovered' check (status in ('discovered', 'researching', 'needs_review', 'approved', 'rejected', 'excluded', 'draft_ready', 'archived')),
  discovery_rank integer,
  source_summary text not null default '',
  user_notes text not null default '',
  first_discovered_at timestamptz not null default now(),
  last_evaluated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (campaign_id, company_id),
  unique (workspace_id, id)
);

