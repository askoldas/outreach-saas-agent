create or replace function public.claim_next_research_task(worker_id text)
returns public.research_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_task public.research_tasks;
begin
  -- A worker can disappear while awaiting a provider. Do not leave its task and
  -- run permanently displayed as running after the lease expires.
  update public.research_tasks
  set
    status = case when attempt_count < max_attempts then 'retrying' else 'failed' end,
    error_message = coalesce(
      error_message,
      case
        when attempt_count < max_attempts then 'Worker lease expired; retrying task.'
        else 'Worker lease expired before the task completed.'
      end
    ),
    completed_at = case
      when attempt_count < max_attempts then null
      else coalesce(completed_at, now())
    end,
    locked_by = null,
    locked_until = null
  where status = 'running'
    and locked_until < now();

  update public.research_runs as run
  set
    status = 'failed',
    current_step = 'Discovery failed',
    error_message = coalesce(run.error_message, 'A background worker stopped before completing the task.'),
    completed_at = coalesce(run.completed_at, now())
  where run.status = 'running'
    and exists (
      select 1 from public.research_tasks task
      where task.run_id = run.id and task.status = 'failed'
    )
    and not exists (
      select 1 from public.research_tasks task
      where task.run_id = run.id
        and task.status in ('pending', 'retrying', 'running')
    );

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
