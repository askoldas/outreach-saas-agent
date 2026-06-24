create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id text not null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  progress int not null default 0 check (progress between 0 and 100),
  current_step text not null default 'Queued',
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.research_runs enable row level security;

create index if not exists research_runs_workspace_campaign_idx
on public.research_runs(workspace_id, campaign_id, created_at desc);

create index if not exists research_runs_status_idx
on public.research_runs(status, created_at);

create table if not exists public.research_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.research_runs(id) on delete cascade,
  campaign_id text not null,
  task_type text not null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed', 'retrying', 'cancelled')
  ),
  payload_json jsonb not null default '{}'::jsonb,
  result_json jsonb,
  attempt_count int not null default 0 check (attempt_count >= 0),
  max_attempts int not null default 3 check (max_attempts >= 1),
  locked_by text,
  locked_until timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.research_tasks enable row level security;

create index if not exists research_tasks_claim_idx
on public.research_tasks(status, locked_until, created_at);

create index if not exists research_tasks_run_idx
on public.research_tasks(run_id, status, created_at);

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid references public.research_runs(id) on delete set null,
  campaign_id text not null,
  source_type text not null default 'tavily_search',
  query text not null,
  title text not null,
  url text not null,
  content text not null default '',
  score numeric,
  classification text not null default 'raw',
  rejection_reason text,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, campaign_id, url)
);

alter table public.lead_sources enable row level security;

create index if not exists lead_sources_workspace_campaign_idx
on public.lead_sources(workspace_id, campaign_id, created_at desc);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid references public.research_runs(id) on delete set null,
  task_id uuid references public.research_tasks(id) on delete set null,
  campaign_id text,
  lead_external_id text,
  provider text not null,
  model text not null,
  task_name text not null,
  prompt_json jsonb not null default '{}'::jsonb,
  output_text text,
  output_json jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'failed')
  ),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.ai_generations enable row level security;

create index if not exists ai_generations_workspace_run_idx
on public.ai_generations(workspace_id, run_id, created_at desc);

create policy "Workspace members can read research runs"
on public.research_runs
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage research runs"
on public.research_runs
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read research tasks"
on public.research_tasks
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage research tasks"
on public.research_tasks
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read lead sources"
on public.lead_sources
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage lead sources"
on public.lead_sources
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read AI generations"
on public.ai_generations
for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage AI generations"
on public.ai_generations
for all
to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create or replace function public.claim_next_research_task(worker_id text)
returns public.research_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_task public.research_tasks;
begin
  update public.research_tasks
  set
    status = 'running',
    attempt_count = attempt_count + 1,
    locked_by = worker_id,
    locked_until = now() + interval '5 minutes',
    started_at = coalesce(started_at, now()),
    error_message = null
  where id = (
    select id
    from public.research_tasks
    where status in ('pending', 'retrying')
      and attempt_count < max_attempts
      and (locked_until is null or locked_until < now())
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into claimed_task;

  if claimed_task.id is not null then
    update public.research_runs
    set
      status = 'running',
      started_at = coalesce(started_at, now()),
      current_step = claimed_task.task_type
    where id = claimed_task.run_id
      and status in ('pending', 'running');
  end if;

  return claimed_task;
end;
$$;

revoke all on function public.claim_next_research_task(text) from public;
revoke all on function public.claim_next_research_task(text) from anon;
revoke all on function public.claim_next_research_task(text) from authenticated;
grant execute on function public.claim_next_research_task(text) to service_role;
