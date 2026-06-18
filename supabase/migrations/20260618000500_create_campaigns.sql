create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 180),
  offer_external_id text not null,
  objective text not null,
  geography text not null,
  target_segments text[] not null default '{}',
  progress int not null default 0 check (progress between 0 and 100),
  lead_count int not null default 0 check (lead_count >= 0),
  awaiting_review int not null default 0 check (awaiting_review >= 0),
  status text not null default 'planning' check (
    status in ('planning', 'running', 'paused', 'completed')
  ),
  last_activity_label text not null default 'Just now',
  language text not null default 'English',
  warnings text[] not null default '{}',
  strategy_terms text[] not null default '{}',
  strategy_localized_terms text[] not null default '{}',
  strategy_sources text[] not null default '{}',
  strategy_criteria text[] not null default '{}',
  strategy_exclusions text[] not null default '{}',
  strategy_limitations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

alter table public.campaigns enable row level security;

create index campaigns_workspace_id_idx on public.campaigns(workspace_id);
create index campaigns_workspace_status_idx on public.campaigns(workspace_id, status);
create index campaigns_workspace_offer_idx on public.campaigns(workspace_id, offer_external_id);

create trigger campaigns_set_updated_at
before update on public.campaigns
for each row execute function public.set_updated_at();

create policy "Workspace members can read campaigns"
on public.campaigns
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage campaigns"
on public.campaigns
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));
