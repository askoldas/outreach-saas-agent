-- Extend Settings > Clear workspace data across the Company Research and
-- Contact Enrichment credit graph introduced by migrations 001-007.

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_company_research_credits;

revoke all on function
  public.clear_workspace_data_before_company_research_credits(uuid)
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

  perform pg_advisory_xact_lock(
    hashtextextended('workspace-clear:' || target_workspace_id::text, 0)
  );

  -- Contact authorizations restrict their underlying reservations. Remove
  -- them before the prior cleanup chain deletes budget reservations.
  delete from public.contact_enrichment_credit_authorizations
  where workspace_id = target_workspace_id;

  -- Explicit deletion keeps cleanup complete even if campaign cascade rules
  -- change later.
  delete from public.research_market_overview_versions
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_company_research_credits(
    target_workspace_id
  );

  -- Clearing all product data starts the current development/MVP workspace
  -- from the same centrally defined grant used for a newly created workspace.
  insert into public.workspace_credit_accounts(workspace_id, available_credits)
  values(target_workspace_id, 120)
  on conflict (workspace_id) do update
    set available_credits = excluded.available_credits,
        updated_at = now();
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public, anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;

