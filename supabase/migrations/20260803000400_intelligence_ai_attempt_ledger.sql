-- Shared append-only attempt ledger for the Intelligence runtime.
create table public.intelligence_ai_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  cache_key text,
  frozen_input_hash text,
  task_id text not null,
  prompt_version text not null,
  schema_version text not null,
  context_compiler_version text not null,
  model_route_version text not null,
  attempt integer not null check (attempt > 0),
  attempt_kind text not null check (attempt_kind in ('initial', 'repair')),
  output_mode text not null check (output_mode in ('json_schema', 'json_object')),
  status text not null check (status in ('completed', 'failed')),
  requested_model text,
  actual_model text,
  fallback_used boolean not null default false,
  request_hash text,
  response_hash text,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  input_units bigint check (input_units is null or input_units >= 0),
  output_units bigint check (output_units is null or output_units >= 0),
  actual_cost numeric(14, 6) check (actual_cost is null or actual_cost >= 0),
  currency text check (currency is null or char_length(currency) = 3),
  validation_issue text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index intelligence_ai_attempts_task_idx
on public.intelligence_ai_attempts(workspace_id, task_id, created_at desc);

create index intelligence_ai_attempts_cache_idx
on public.intelligence_ai_attempts(workspace_id, cache_key, created_at desc)
where cache_key is not null;

alter table public.intelligence_ai_attempts enable row level security;

create policy "Members can read Intelligence AI attempts"
on public.intelligence_ai_attempts for select to authenticated
using (public.is_workspace_member(workspace_id));

revoke insert, update, delete on public.intelligence_ai_attempts from authenticated, anon;
grant select on public.intelligence_ai_attempts to authenticated;
grant select, insert on public.intelligence_ai_attempts to service_role;
