create table public.outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  lead_external_id text not null,
  campaign_external_id text not null,
  recipient_route text not null,
  subject text not null,
  body text not null,
  variant text not null check (variant in ('primary', 'short', 'follow_up')),
  language text not null default 'English',
  status text not null default 'needs_review' check (
    status in ('needs_review', 'approved', 'edited', 'rejected')
  ),
  last_edited_label text not null default 'Just now',
  seller_claims text[] not null default '{}',
  evidence_used text[] not null default '{}',
  warnings text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

alter table public.outreach_drafts enable row level security;

create index outreach_drafts_workspace_id_idx on public.outreach_drafts(workspace_id);
create index outreach_drafts_workspace_status_idx on public.outreach_drafts(workspace_id, status);
create index outreach_drafts_workspace_campaign_idx on public.outreach_drafts(workspace_id, campaign_external_id);
create index outreach_drafts_workspace_lead_idx on public.outreach_drafts(workspace_id, lead_external_id);

create trigger outreach_drafts_set_updated_at
before update on public.outreach_drafts
for each row execute function public.set_updated_at();

create policy "Workspace members can read outreach drafts"
on public.outreach_drafts
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage outreach drafts"
on public.outreach_drafts
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));
