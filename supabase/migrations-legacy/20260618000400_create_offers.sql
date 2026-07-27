create table public.offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 180),
  type text not null check (
    type in (
      'product',
      'service',
      'software',
      'distribution',
      'manufacturing',
      'partnership'
    )
  ),
  summary text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  approved_version text not null default 'No approved version',
  last_updated_label text not null default 'Today',
  campaign_count int not null default 0 check (campaign_count >= 0),
  problems text[] not null default '{}',
  capabilities text[] not null default '{}',
  customer_value text[] not null default '{}',
  buyer_types text[] not null default '{}',
  differentiators text[] not null default '{}',
  limitations text[] not null default '{}',
  keywords text[] not null default '{}',
  ai_proposals text[] not null default '{}',
  missing_info text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

alter table public.offers enable row level security;

create index offers_workspace_id_idx on public.offers(workspace_id);
create index offers_workspace_status_idx on public.offers(workspace_id, status);

create trigger offers_set_updated_at
before update on public.offers
for each row execute function public.set_updated_at();

create policy "Workspace members can read offers"
on public.offers
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage offers"
on public.offers
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));
