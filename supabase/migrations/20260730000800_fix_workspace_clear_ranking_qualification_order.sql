-- Ranking V2 introduced restrictive references to Qualification batches after
-- the cleanup wrapper had already been defined. Remove the ranking graph first,
-- then delegate to the existing tenant-scoped cleanup chain.

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_ranking_qualification_order_v2;

revoke all on function
  public.clear_workspace_data_before_ranking_qualification_order_v2(uuid)
from public, anon, authenticated;

create function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  perform set_config(
    'app.workspace_cleanup_id',
    target_workspace_id::text,
    true
  );

  delete from public.candidate_rank_entries
  where workspace_id = target_workspace_id;

  delete from public.candidate_rank_snapshots
  where workspace_id = target_workspace_id;

  delete from public.comparative_anomalies
  where workspace_id = target_workspace_id;

  delete from public.comparative_batch_members
  where workspace_id = target_workspace_id;

  delete from public.comparative_batches
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_ranking_qualification_order_v2(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid)
from public, anon;

grant execute on function public.clear_workspace_data(uuid)
to authenticated;
