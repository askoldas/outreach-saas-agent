create table public.campaign_agent_checkpoints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  iteration integer not null check (iteration between 0 and 5),
  phase text not null check (
    phase in ('perceive', 'retrieve', 'plan', 'act', 'evaluate', 'refine', 'gate', 'complete')
  ),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  unique (campaign_run_id, iteration, phase)
);

create index campaign_agent_checkpoints_run_created_idx
  on public.campaign_agent_checkpoints (campaign_run_id, created_at desc);

alter table public.campaign_agent_checkpoints enable row level security;

create policy campaign_agent_checkpoints_select_member
  on public.campaign_agent_checkpoints
  for select
  using (public.is_workspace_member(workspace_id));

create policy campaign_agent_checkpoints_service_role_all
  on public.campaign_agent_checkpoints
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.enforce_campaign_agent_checkpoint_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.campaign_runs run
    where run.id = new.campaign_run_id
      and run.workspace_id = new.workspace_id
  ) then
    raise exception 'Campaign Agent checkpoint workspace does not match Campaign Run';
  end if;
  return new;
end;
$$;

create trigger campaign_agent_checkpoint_workspace_guard
before insert or update on public.campaign_agent_checkpoints
for each row execute function public.enforce_campaign_agent_checkpoint_workspace();
