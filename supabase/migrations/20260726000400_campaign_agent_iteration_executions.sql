alter table public.provider_executions
  add column parent_execution_id uuid references public.provider_executions(id) on delete set null,
  add column agent_iteration integer check (
    agent_iteration is null or agent_iteration between 1 and 5
  );

create unique index provider_executions_agent_iteration_unique
  on public.provider_executions (parent_execution_id, agent_iteration);

create index provider_executions_parent_idx
  on public.provider_executions (parent_execution_id, agent_iteration);

create or replace function public.enforce_agent_iteration_execution()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_row public.provider_executions;
begin
  if new.parent_execution_id is null and new.agent_iteration is null then
    return new;
  end if;
  if new.parent_execution_id is null or new.agent_iteration is null then
    raise exception 'Campaign Agent execution requires both parent_execution_id and agent_iteration';
  end if;

  select * into parent_row
  from public.provider_executions
  where id = new.parent_execution_id;

  if parent_row.id is null
    or parent_row.workspace_id <> new.workspace_id
    or parent_row.campaign_run_id is distinct from new.campaign_run_id
    or parent_row.operation <> 'campaign_discovery'
    or new.operation <> 'campaign_discovery'
  then
    raise exception 'Campaign Agent iteration execution does not match its discovery parent';
  end if;
  return new;
end;
$$;

create trigger provider_execution_agent_iteration_guard
before insert or update of parent_execution_id, agent_iteration, workspace_id,
  campaign_run_id, operation
on public.provider_executions
for each row execute function public.enforce_agent_iteration_execution();
