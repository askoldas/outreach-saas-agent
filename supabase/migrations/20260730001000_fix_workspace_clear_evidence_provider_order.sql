-- Make workspace cleanup independent of older function-chain ordering.
-- Evidence rows restrict deletion of provider executions and page fetches, so
-- remove the complete evidence dependency set before delegating to the
-- existing tenant-scoped cleanup chain.

create or replace function public.prevent_evidence_claim_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.workspace_cleanup_id', true) = old.workspace_id::text
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  raise exception
    'Evidence and claims are immutable; append or supersede records instead.';
end;
$$;

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_evidence_provider_order_v2;

revoke all on function
  public.clear_workspace_data_before_evidence_provider_order_v2(uuid)
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

  delete from public.candidate_research_member_sources_v2
  where workspace_id = target_workspace_id;

  delete from public.candidate_research_tasks
  where workspace_id = target_workspace_id;

  delete from public.memory_evidence_links
  where workspace_id = target_workspace_id;

  delete from public.claim_evidence_links
  where workspace_id = target_workspace_id;

  delete from public.evidence_items
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_evidence_provider_order_v2(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid)
from public, anon;

grant execute on function public.clear_workspace_data(uuid)
to authenticated;
