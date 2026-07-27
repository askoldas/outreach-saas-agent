create table public.ai_guided_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('company_profile', 'campaign')),
  entity_id uuid,
  base_version integer not null check (base_version > 0),
  status text not null default 'draft' check (status in ('draft', 'ready', 'applied', 'discarded', 'stale')),
  proposal jsonb not null default '{}'::jsonb check (jsonb_typeof(proposal) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scope text not null check (scope in ('company_profile', 'campaign')),
  entity_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.ai_applied_changes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  guided_draft_id uuid references public.ai_guided_drafts(id) on delete set null,
  scope text not null,
  entity_id uuid,
  source_version integer not null,
  target_version integer not null,
  changes jsonb not null check (jsonb_typeof(changes) = 'array'),
  undo_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(undo_metadata) = 'object'),
  applied_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

