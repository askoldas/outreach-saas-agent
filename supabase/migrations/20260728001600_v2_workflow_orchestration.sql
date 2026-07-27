-- Durable Intelligence V2 workflow orchestration.
-- Apply after 20260728001500_comparative_ranking_v2.sql.

create table public.intelligence_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_version_id uuid not null references public.workflow_versions(id) on delete restrict,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  workflow_family text not null default 'campaign_v2',
  subject_type text not null default 'campaign_run',
  subject_id uuid not null,
  status text not null default 'queued' check (status in (
    'queued','initializing','discovering','resolving_entities','evaluating_candidates',
    'ranking','ready_for_review','pausing','paused','cancelling','cancelled',
    'completed','completed_partial','failed'
  )),
  trigger_run_id text,
  requested_by_user_id uuid references auth.users(id) on delete set null,
  input_reference_json jsonb not null check (jsonb_typeof(input_reference_json) = 'object'),
  output_reference_json jsonb check (output_reference_json is null or jsonb_typeof(output_reference_json) = 'object'),
  progress_summary_json jsonb not null default '{}'::jsonb check (jsonb_typeof(progress_summary_json) = 'object'),
  error_summary_json jsonb check (error_summary_json is null or jsonb_typeof(error_summary_json) = 'object'),
  started_at timestamptz,
  completed_at timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_run_id)
);

create table public.intelligence_task_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_run_id uuid not null references public.intelligence_workflow_runs(id) on delete cascade,
  parent_task_run_id uuid references public.intelligence_task_runs(id) on delete cascade,
  task_type text not null,
  status text not null default 'pending' check (status in ('pending','claimed','running','completed','partial','blocked','retry_wait','failed','cancelled','skipped')),
  idempotency_key text not null unique,
  input_fingerprint text not null,
  input_reference_json jsonb not null check (jsonb_typeof(input_reference_json) = 'object'),
  output_reference_json jsonb check (output_reference_json is null or jsonb_typeof(output_reference_json) = 'object'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  trigger_run_id text,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_details_json jsonb check (error_details_json is null or jsonb_typeof(error_details_json) = 'object'),
  created_at timestamptz not null default now()
);

create table public.intelligence_task_attempts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_run_id uuid not null references public.intelligence_task_runs(id) on delete cascade,
  attempt_number integer not null check (attempt_number > 0),
  trigger_execution_id text,
  status text not null check (status in ('running','completed','failed','cancelled')),
  metrics_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics_json) = 'object'),
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (task_run_id, attempt_number)
);

create table public.workflow_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_run_id uuid not null references public.intelligence_workflow_runs(id) on delete cascade,
  checkpoint_key text not null,
  checkpoint_version integer not null check (checkpoint_version > 0),
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (workflow_run_id, checkpoint_key, checkpoint_version)
);

create table public.workflow_commands (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  command_type text not null check (command_type in ('pause','resume','cancel')),
  subject_type text not null default 'campaign_run',
  subject_id uuid not null,
  payload_json jsonb not null default '{}'::jsonb check (jsonb_typeof(payload_json) = 'object'),
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','superseded')),
  requested_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.workflow_outbox (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  command_id uuid references public.workflow_commands(id) on delete cascade,
  event_type text not null,
  payload_json jsonb not null check (jsonb_typeof(payload_json) = 'object'),
  status text not null default 'pending' check (status in ('pending','publishing','published','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.intelligence_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  workflow_run_id uuid not null references public.intelligence_workflow_runs(id) on delete cascade,
  task_run_id uuid references public.intelligence_task_runs(id) on delete set null,
  provider_key text not null,
  usage_type text not null,
  quantity numeric not null check (quantity >= 0),
  unit text not null,
  provider_cost_amount numeric check (provider_cost_amount is null or provider_cost_amount >= 0),
  provider_cost_currency text,
  usage_json jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_json) = 'object'),
  idempotency_key text not null unique,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index intelligence_task_runs_active_idx on public.intelligence_task_runs(workflow_run_id, status) where status in ('pending','claimed','running','retry_wait','blocked');
create index workflow_commands_pending_idx on public.workflow_commands(workspace_id, subject_id, created_at) where status = 'pending';
create index workflow_outbox_pending_idx on public.workflow_outbox(status, available_at) where status in ('pending','failed');

create or replace function public.validate_v2_workflow_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name = 'intelligence_workflow_runs' then
    select workspace_id into expected_workspace_id from public.campaign_runs where id = new.campaign_run_id;
  elsif tg_table_name in ('intelligence_task_runs','workflow_checkpoints','intelligence_usage_events') then
    select workspace_id into expected_workspace_id from public.intelligence_workflow_runs where id = new.workflow_run_id;
  elsif tg_table_name = 'intelligence_task_attempts' then
    select workspace_id into expected_workspace_id from public.intelligence_task_runs where id = new.task_run_id;
  else expected_workspace_id := new.workspace_id;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then raise exception 'V2 workflow workspace mismatch.'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['intelligence_workflow_runs','intelligence_task_runs','intelligence_task_attempts','workflow_checkpoints','workflow_commands','workflow_outbox','intelligence_usage_events'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.validate_v2_workflow_workspace()', table_name || '_workspace_guard', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', 'Members can read ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))', 'Admins can manage ' || table_name, table_name);
  end loop;
end;
$$;
