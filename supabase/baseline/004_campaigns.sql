create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 180),
  objective text not null,
  selected_offering_id text,
  target_geography text not null default '',
  initial_target_description text not null default '',
  industries text[] not null default '{}',
  company_characteristics text[] not null default '{}',
  relevant_use_case text not null default '',
  exclusions text[] not null default '{}',
  target_volume integer not null default 25 check (target_volume > 0),
  budget_limit numeric(14, 4) check (budget_limit is null or budget_limit >= 0),
  budget_currency text not null default 'EUR' check (char_length(budget_currency) = 3),
  preferred_outreach_language text not null default 'English',
  outreach_enabled boolean not null default false,
  approval_settings jsonb not null default '{}'::jsonb check (jsonb_typeof(approval_settings) = 'object'),
  status text not null default 'planning' check (status in ('planning', 'active', 'paused', 'completed', 'archived')),
  profile_snapshot_id uuid,
  current_strategy_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id),
  unique (workspace_id, id)
);

alter table public.campaign_profile_snapshots
  add constraint campaign_profile_snapshots_campaign_fk
  foreign key (campaign_id) references public.campaigns(id) on delete cascade;

alter table public.campaigns
  add constraint campaigns_profile_snapshot_fk
  foreign key (profile_snapshot_id) references public.campaign_profile_snapshots(id) on delete restrict;

create table public.campaign_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version integer not null check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'used', 'superseded')),
  strategy jsonb not null default '{}'::jsonb check (jsonb_typeof(strategy) = 'object'),
  prompt_version text,
  model_config_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (workspace_id, id)
);

alter table public.campaigns
  add constraint campaigns_current_strategy_fk
  foreign key (current_strategy_version_id) references public.campaign_strategy_versions(id) on delete restrict;

