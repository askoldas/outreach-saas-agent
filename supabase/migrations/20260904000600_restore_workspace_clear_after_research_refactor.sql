-- Keep Settings > Clear workspace data complete and usable after the research refactor.
-- The authenticated admin RPC can legitimately exceed the short API statement timeout
-- while removing a full evidence graph, so give this destructive operation a bounded
-- function-specific timeout and remove the newest leaves before the legacy chain.

do $$
begin
  if to_regprocedure(
    'public.clear_workspace_data_before_research_refactor_cleanup(uuid)'
  ) is null then
    alter function public.clear_workspace_data(uuid)
      rename to clear_workspace_data_before_research_refactor_cleanup;
  end if;
end;
$$;

revoke all on function
  public.clear_workspace_data_before_research_refactor_cleanup(uuid)
from public, anon, authenticated;

create or replace function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
set statement_timeout = '120s'
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('workspace-clear:' || target_workspace_id::text, 0)
  );

  if to_regclass('public.candidate_triage_decisions_v2') is not null then
    execute
      'delete from public.candidate_triage_decisions_v2 where workspace_id = $1'
    using target_workspace_id;
  end if;

  if to_regclass('public.market_research_executions_v2') is not null then
    execute
      'delete from public.market_research_executions_v2 where workspace_id = $1'
    using target_workspace_id;
  end if;

  perform public.clear_workspace_data_before_research_refactor_cleanup(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public, anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;
