create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sequence_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sequence_id uuid not null references public.sequences(id) on delete cascade,
  step_number integer not null check (step_number > 0),
  step_type text not null check (step_type in ('email_draft', 'manual_task')),
  delay_hours integer not null default 0 check (delay_hours >= 0),
  template jsonb not null default '{}'::jsonb check (jsonb_typeof(template) = 'object'),
  unique (sequence_id, step_number)
);

create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  campaign_company_id uuid not null references public.campaign_companies(id) on delete cascade,
  campaign_contact_id uuid references public.campaign_contacts(id) on delete set null,
  sequence_step_id uuid references public.sequence_steps(id) on delete set null,
  profile_snapshot_id uuid not null references public.campaign_profile_snapshots(id) on delete restrict,
  strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  subject text not null,
  body text not null,
  variant text not null check (variant in ('primary', 'short', 'follow_up')),
  language text not null default 'English',
  status text not null default 'needs_review' check (status in ('needs_review', 'approved', 'edited', 'rejected')),
  seller_claims text[] not null default '{}',
  evidence_used uuid[] not null default '{}',
  warnings text[] not null default '{}',
  prompt_version text,
  model_config_id uuid,
  input_hash text not null,
  generated_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_company_id, campaign_contact_id, variant, input_hash)
);

create table public.export_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  export_type text not null check (export_type in ('outreach_csv', 'company_research_csv')),
  file_name text not null,
  row_count integer not null check (row_count >= 0),
  payload jsonb not null default '[]'::jsonb check (jsonb_typeof(payload) = 'array'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

