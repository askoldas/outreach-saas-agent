create table public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid references public.company_profiles(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  storage_bucket text not null default 'workspace-documents',
  storage_path text not null,
  file_name text not null,
  media_type text not null,
  size_bytes bigint not null check (size_bytes >= 0),
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'ready', 'failed', 'deleted')),
  checksum text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, storage_path)
);

create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null,
  page_number integer,
  section text,
  embedding extensions.vector(1536),
  embedding_model text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table public.campaign_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  scope text not null,
  category text not null,
  statement text not null,
  evidence_ids uuid[] not null default '{}',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected')),
  origin text not null,
  retention_class text not null default 'campaign',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.workspace_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  category text not null,
  statement text not null,
  evidence_ids uuid[] not null default '{}',
  confidence text not null check (confidence in ('high', 'medium', 'low')),
  approval_status text not null default 'proposed' check (approval_status in ('proposed', 'approved', 'rejected')),
  origin text not null,
  retention_class text not null default 'workspace',
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

insert into storage.buckets (id, name, public)
values ('workspace-documents', 'workspace-documents', false)
on conflict (id) do update set public = false;
