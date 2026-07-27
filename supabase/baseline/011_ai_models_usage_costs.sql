create table public.ai_model_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  role text not null check (role in ('campaign_planning', 'profile_analysis', 'company_qualification', 'outreach_generation', 'website_extraction', 'search_result_classification', 'guided_interpretation', 'reflection', 'embedding')),
  gateway text not null default 'openrouter',
  provider text not null,
  model_id text not null,
  fallback_model_id text,
  temperature numeric(4, 3) check (temperature is null or temperature between 0 and 2),
  max_output_tokens integer check (max_output_tokens is null or max_output_tokens > 0),
  timeout_ms integer not null default 120000 check (timeout_ms >= 5000),
  cost_limit numeric(14, 6) check (cost_limit is null or cost_limit >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  enabled boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, role)
);

create table public.operation_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null default 'started' check (status in ('started', 'completed', 'failed', 'cancelled')),
  result_reference_type text,
  result_reference_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (workspace_id, operation, idempotency_key)
);

create table public.provider_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider text not null,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  attempt integer not null default 1 check (attempt > 0),
  provider_reference text,
  input_units bigint,
  output_units bigint,
  estimated_cost numeric(14, 6) not null default 0 check (estimated_cost >= 0),
  actual_cost numeric(14, 6) not null default 0 check (actual_cost >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  provider_cost numeric(14, 6),
  provider_currency text check (provider_currency is null or char_length(provider_currency) = 3),
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, operation, idempotency_key, attempt)
);

create table public.ai_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider_execution_id uuid references public.provider_executions(id) on delete set null,
  model_config_id uuid references public.ai_model_configs(id) on delete restrict,
  role text not null,
  provider text not null,
  selected_model text not null,
  fallback_model text,
  fallback_used boolean not null default false,
  prompt_version text not null,
  schema_version text,
  request_hash text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled')),
  input_units bigint,
  output_units bigint,
  estimated_cost numeric(14, 6) not null default 0,
  actual_cost numeric(14, 6) not null default 0,
  currency text not null default 'EUR',
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  provider_execution_id uuid references public.provider_executions(id) on delete set null,
  operation text not null,
  entry_type text not null check (entry_type in ('estimate', 'reservation', 'settlement', 'adjustment', 'release')),
  idempotency_key text not null,
  credits numeric(14, 4) not null default 0,
  amount numeric(14, 6) not null default 0,
  currency text not null default 'EUR' check (char_length(currency) = 3),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (workspace_id, entry_type, idempotency_key)
);

create table public.budget_reservations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  status text not null default 'reserved' check (status in ('reserved', 'settled', 'released', 'expired')),
  reserved_amount numeric(14, 6) not null check (reserved_amount >= 0),
  settled_amount numeric(14, 6) check (settled_amount is null or settled_amount >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (workspace_id, operation, idempotency_key)
);

insert into public.ai_model_configs (role, gateway, provider, model_id, fallback_model_id)
values
  ('campaign_planning', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('profile_analysis', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('company_qualification', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('outreach_generation', 'openrouter', 'anthropic', 'anthropic/claude-sonnet-4.6', 'openai/gpt-5-mini'),
  ('website_extraction', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('search_result_classification', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('guided_interpretation', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('reflection', 'openrouter', 'google', 'google/gemini-2.5-flash', 'openai/gpt-5-mini'),
  ('embedding', 'openrouter', 'openai', 'openai/text-embedding-3-small', null);

