create or replace function public.assert_staged_campaign_tenant_integrity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'campaign_briefs' then
    if not exists (
      select 1
      from public.campaigns c
      join public.company_profile_versions pv
        on pv.id = new.profile_version_id
       and pv.workspace_id = new.workspace_id
      where c.id = new.campaign_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Campaign brief references entities from different workspaces.';
    end if;
  elsif tg_table_name = 'market_analyses' then
    if not exists (
      select 1
      from public.campaign_runs r
      where r.id = new.campaign_run_id
        and r.campaign_id = new.campaign_id
        and r.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Market analysis Campaign and Campaign Run do not share a workspace.';
    end if;
  elsif tg_table_name = 'discovery_plans' then
    if not exists (
      select 1
      from public.campaign_runs r
      join public.market_analyses ma
        on ma.id = new.market_analysis_id
       and ma.campaign_id = r.campaign_id
       and ma.campaign_run_id = r.id
       and ma.workspace_id = r.workspace_id
      where r.id = new.campaign_run_id
        and r.campaign_id = new.campaign_id
        and r.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Discovery plan references an inconsistent Campaign stage.';
    end if;
  elsif tg_table_name = 'discovery_paths' then
    if not exists (
      select 1 from public.discovery_plans p
      where p.id = new.discovery_plan_id
        and p.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Discovery path and plan do not share a workspace.';
    end if;
  elsif tg_table_name = 'discovery_iterations' then
    if not exists (
      select 1
      from public.campaign_runs r
      join public.discovery_plans p
        on p.id = new.discovery_plan_id
       and p.campaign_id = r.campaign_id
       and p.campaign_run_id = r.id
       and p.workspace_id = r.workspace_id
      where r.id = new.campaign_run_id
        and r.campaign_id = new.campaign_id
        and r.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Discovery iteration references an inconsistent Campaign stage.';
    end if;
  elsif tg_table_name = 'discovery_queries' then
    if not exists (
      select 1
      from public.discovery_iterations i
      join public.discovery_paths p
        on p.id = new.discovery_path_id
       and p.discovery_plan_id = i.discovery_plan_id
       and p.workspace_id = i.workspace_id
      where i.id = new.discovery_iteration_id
        and i.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Discovery query path and iteration do not share a plan and workspace.';
    end if;
  elsif tg_table_name = 'discovery_candidates' then
    if not exists (
      select 1
      from public.campaign_runs r
      join public.discovery_iterations i
        on i.id = new.discovery_iteration_id
       and i.campaign_id = r.campaign_id
       and i.campaign_run_id = r.id
       and i.workspace_id = r.workspace_id
      join public.discovery_queries q
        on q.id = new.discovery_query_id
       and q.discovery_iteration_id = i.id
       and q.workspace_id = i.workspace_id
      where r.id = new.campaign_run_id
        and r.campaign_id = new.campaign_id
        and r.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Discovery candidate references an inconsistent Campaign stage.';
    end if;
  elsif tg_table_name = 'candidate_classifications' then
    if not exists (
      select 1
      from public.discovery_candidates c
      where c.id = new.candidate_id
        and c.campaign_run_id = new.campaign_run_id
        and c.workspace_id = new.workspace_id
    ) then
      raise exception using
        errcode = '23514',
        message = 'Candidate classification and candidate do not share a Campaign Run.';
    end if;
  end if;
  return new;
end;
$$;

do $$
declare
  staged_table text;
begin
  foreach staged_table in array array[
    'campaign_briefs',
    'market_analyses',
    'discovery_plans',
    'discovery_paths',
    'discovery_iterations',
    'discovery_queries',
    'discovery_candidates',
    'candidate_classifications'
  ]
  loop
    execute format(
      'drop trigger if exists staged_campaign_tenant_integrity on public.%I',
      staged_table
    );
    execute format(
      'create trigger staged_campaign_tenant_integrity before insert or update on public.%I for each row execute function public.assert_staged_campaign_tenant_integrity()',
      staged_table
    );
  end loop;
end;
$$;

revoke all on function public.assert_staged_campaign_tenant_integrity() from public;
revoke all on function public.assert_staged_campaign_tenant_integrity() from anon;
revoke all on function public.assert_staged_campaign_tenant_integrity() from authenticated;
