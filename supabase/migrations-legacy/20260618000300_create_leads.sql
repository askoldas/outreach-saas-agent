create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_id text not null check (external_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  company text not null check (char_length(trim(company)) between 1 and 180),
  website text not null,
  country text not null,
  city text not null,
  campaign_id text,
  company_type text not null,
  industry text not null,
  estimated_size text not null,
  description text not null,
  fit_score int not null check (fit_score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  contactability text not null check (contactability in ('high', 'medium', 'low')),
  status text not null default 'needs_review' check (
    status in (
      'needs_review',
      'approved',
      'rejected',
      'draft_ready',
      'researching',
      'archived'
    )
  ),
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_id)
);

alter table public.leads enable row level security;

create index leads_workspace_id_idx on public.leads(workspace_id);
create index leads_workspace_status_idx on public.leads(workspace_id, status);
create index leads_workspace_fit_score_idx on public.leads(workspace_id, fit_score desc);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table public.lead_qualification_dimensions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  label text not null,
  score int not null check (score between 0 and 100),
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  explanation text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_qualification_dimensions enable row level security;

create index lead_qualification_dimensions_lead_id_idx
on public.lead_qualification_dimensions(lead_id, sort_order);

create trigger lead_qualification_dimensions_set_updated_at
before update on public.lead_qualification_dimensions
for each row execute function public.set_updated_at();

create table public.lead_evidence_claims (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  external_id text not null,
  kind text not null check (kind in ('fact', 'inference', 'unknown', 'conflict')),
  text text not null,
  source_type text not null,
  source_label text not null,
  source_url text not null,
  retrieved_at date not null,
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, external_id)
);

alter table public.lead_evidence_claims enable row level security;

create index lead_evidence_claims_lead_id_idx
on public.lead_evidence_claims(lead_id, sort_order);

create trigger lead_evidence_claims_set_updated_at
before update on public.lead_evidence_claims
for each row execute function public.set_updated_at();

create table public.lead_contact_routes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null,
  value text not null,
  suggested_role text not null,
  verification text not null check (
    verification in ('source_confirmed', 'unverified', 'unknown')
  ),
  source text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_contact_routes enable row level security;

create index lead_contact_routes_lead_id_idx
on public.lead_contact_routes(lead_id, sort_order);

create trigger lead_contact_routes_set_updated_at
before update on public.lead_contact_routes
for each row execute function public.set_updated_at();

create policy "Workspace members can read leads"
on public.leads
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage leads"
on public.leads
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read lead qualification"
on public.lead_qualification_dimensions
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_member(l.workspace_id)
  )
);

create policy "Workspace admins can manage lead qualification"
on public.lead_qualification_dimensions
for all
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
);

create policy "Workspace members can read lead evidence"
on public.lead_evidence_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_member(l.workspace_id)
  )
);

create policy "Workspace admins can manage lead evidence"
on public.lead_evidence_claims
for all
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
);

create policy "Workspace members can read lead contacts"
on public.lead_contact_routes
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_member(l.workspace_id)
  )
);

create policy "Workspace admins can manage lead contacts"
on public.lead_contact_routes
for all
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
)
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_id
      and public.is_workspace_admin(l.workspace_id)
  )
);
