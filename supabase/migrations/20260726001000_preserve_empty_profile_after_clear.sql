-- Every workspace must retain an empty Company Profile aggregate after cleanup.
-- Keep the already-applied cleanup implementation as a private transactional helper,
-- then restore the required empty container before the transaction commits.

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_delete_all_legacy;

revoke all on function public.clear_workspace_data_delete_all_legacy(uuid) from public;
revoke all on function public.clear_workspace_data_delete_all_legacy(uuid) from anon;
revoke all on function public.clear_workspace_data_delete_all_legacy(uuid) from authenticated;

insert into public.company_profiles (workspace_id)
select workspace.id
from public.workspaces as workspace
where not exists (
  select 1
  from public.company_profiles as profile
  where profile.workspace_id = workspace.id
);

create function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.clear_workspace_data_delete_all_legacy(target_workspace_id);

  insert into public.company_profiles (workspace_id)
  values (target_workspace_id)
  on conflict (workspace_id) do update
  set current_version_id = null,
      updated_at = now();
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public;
revoke all on function public.clear_workspace_data(uuid) from anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;
