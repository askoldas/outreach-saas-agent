create table public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  profile_snapshot_id uuid not null references public.campaign_profile_snapshots(id) on delete restrict,
  status text not null default 'draft' check (status in (
    'draft', 'queued', 'planning', 'waiting_for_input', 'discovering', 'evaluating',
    'qualifying', 'waiting_for_enrichment_approval', 'enriching',
    'preparing_outreach', 'waiting_for_outreach_approval', 'scheduled', 'completed',
    'partially_completed', 'failed', 'cancelled'
  )),
  current_phase text not null default 'draft',
  current_iteration integer not null default 0 check (current_iteration >= 0),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  companies_discovered integer not null default 0 check (companies_discovered >= 0),
  companies_qualified integer not null default 0 check (companies_qualified >= 0),
  contacts_found integer not null default 0 check (contacts_found >= 0),
  llm_cost numeric(14, 6) not null default 0 check (llm_cost >= 0),
  provider_cost numeric(14, 6) not null default 0 check (provider_cost >= 0),
  total_cost numeric(14, 6) generated always as (llm_cost + provider_cost) stored,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  trigger_run_id text unique,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.campaign_run_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  event_type text not null,
  phase text,
  level text not null default 'info' check (level in ('debug', 'info', 'warning', 'error')),
  summary text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  visible_to_user boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.campaign_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  question_type text not null,
  question text not null,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed', 'expired')),
  answer jsonb,
  answered_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  approval_type text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
  requested_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(requested_payload) = 'object'),
  decision_notes text,
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  unique (campaign_run_id, approval_type, status)
);

