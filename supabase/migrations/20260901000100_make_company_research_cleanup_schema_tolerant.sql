-- Repair Settings > Clear workspace data for environments where optional
-- Company Research migrations were not applied consistently. Core cleanup
-- remains strict; only the newly introduced feature tables are conditional.

create or replace function public.clear_workspace_data(target_workspace_id uuid)
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

  if to_regclass('public.contact_enrichment_credit_authorizations') is not null then
    execute
      'delete from public.contact_enrichment_credit_authorizations where workspace_id = $1'
    using target_workspace_id;
  end if;

  if to_regclass('public.research_market_overview_versions') is not null then
    execute
      'delete from public.research_market_overview_versions where workspace_id = $1'
    using target_workspace_id;
  end if;

  perform public.clear_workspace_data_before_company_research_credits(
    target_workspace_id
  );

  if to_regclass('public.workspace_credit_accounts') is not null then
    execute $credit_reset$
      insert into public.workspace_credit_accounts(workspace_id, available_credits)
      values($1, 120)
      on conflict (workspace_id) do update
        set available_credits = excluded.available_credits,
            updated_at = now()
    $credit_reset$ using target_workspace_id;
  end if;
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public, anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;

