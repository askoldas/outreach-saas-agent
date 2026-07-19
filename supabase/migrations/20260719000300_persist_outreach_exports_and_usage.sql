create table public.lead_outreach_states (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  enrichment_status text not null default 'not_started' check (enrichment_status in ('not_started','queued','in_progress','contacts_ready','not_found','issue')),
  selected_contact_route_id uuid references public.lead_contact_routes(id) on delete set null,
  selection_status text not null default 'automatic' check (selection_status in ('automatic','accepted','overridden','no_route')),
  recommendation_reason text not null default '', enrichment_run_id uuid references public.research_runs(id) on delete set null,
  last_error text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.export_records (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_external_id text not null, export_type text not null check (export_type in ('outreach_csv','lead_research_csv')),
  file_name text not null, row_count int not null check (row_count >= 0), payload_json jsonb not null default '[]'::jsonb check (jsonb_typeof(payload_json)='array'),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_external_id text, operation text not null check (operation in ('company_research','source_processing','qualification','contact_enrichment','verification','draft_generation','export')),
  estimated_credits int not null default 0 check (estimated_credits >= 0), actual_credits int not null default 0 check (actual_credits >= 0),
  reference_type text, reference_id text, metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json)='object'),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);

create index lead_outreach_states_workspace_idx on public.lead_outreach_states(workspace_id, enrichment_status);
create index export_records_workspace_campaign_idx on public.export_records(workspace_id,campaign_external_id,created_at desc);
create index usage_events_workspace_created_idx on public.usage_events(workspace_id,created_at desc);
create index usage_events_workspace_campaign_idx on public.usage_events(workspace_id,campaign_external_id,created_at desc);
create trigger lead_outreach_states_set_updated_at before update on public.lead_outreach_states for each row execute function public.set_updated_at();

alter table public.lead_outreach_states enable row level security; alter table public.export_records enable row level security; alter table public.usage_events enable row level security;
create policy "Workspace members can read lead outreach states" on public.lead_outreach_states for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace admins can manage lead outreach states" on public.lead_outreach_states for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));
create policy "Workspace members can read exports" on public.export_records for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace admins can create exports" on public.export_records for insert to authenticated with check (public.is_workspace_admin(workspace_id));
create policy "Workspace members can read usage" on public.usage_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Workspace admins can create usage" on public.usage_events for insert to authenticated with check (public.is_workspace_admin(workspace_id));

insert into public.lead_outreach_states (workspace_id,lead_id,enrichment_status,selection_status)
select workspace_id,id,case when exists(select 1 from public.lead_contact_routes r where r.lead_id=leads.id) then 'contacts_ready' else 'not_started' end,'automatic'
from public.leads on conflict (lead_id) do nothing;
