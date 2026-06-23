create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null check (
    entity_type in ('offer', 'campaign', 'lead', 'draft', 'workspace')
  ),
  entity_external_id text,
  label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

alter table public.activity_events enable row level security;

create index activity_events_workspace_created_at_idx
on public.activity_events(workspace_id, created_at desc);

create policy "Workspace members can read activity events"
on public.activity_events
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can create activity events"
on public.activity_events
for insert
to authenticated
with check (public.is_workspace_admin(workspace_id));
