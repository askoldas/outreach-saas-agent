create or replace function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_workspace public.workspaces;
  new_profile_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  select * into target_workspace
  from public.workspaces
  where id = target_workspace_id
  for update;

  if target_workspace.id is null then
    raise exception 'Workspace not found';
  end if;

  -- Delete independent workspace history before the campaign/profile graph. Some
  -- of these tables intentionally have no authenticated DELETE policy.
  delete from public.activity_events where workspace_id = target_workspace_id;
  delete from public.export_records where workspace_id = target_workspace_id;
  delete from public.usage_events where workspace_id = target_workspace_id;
  delete from public.ai_generations where workspace_id = target_workspace_id;
  delete from public.lead_sources where workspace_id = target_workspace_id;
  delete from public.outreach_drafts where workspace_id = target_workspace_id;

  -- Break the campaign-to-current-strategy reference before deleting runs and
  -- campaigns. Campaign deletion then cascades through strategies, snapshots,
  -- leads, qualification, evidence, contacts, and outreach selection state.
  update public.campaigns
  set current_strategy_version_id = null
  where workspace_id = target_workspace_id;

  delete from public.research_tasks where workspace_id = target_workspace_id;
  delete from public.research_runs where workspace_id = target_workspace_id;
  delete from public.leads where workspace_id = target_workspace_id;
  delete from public.campaigns where workspace_id = target_workspace_id;

  -- Company Profile is required application state. Remove every saved version
  -- and recreate only the same empty baseline produced for a new workspace.
  delete from public.company_profiles where workspace_id = target_workspace_id;

  insert into public.company_profiles (workspace_id)
  values (target_workspace_id)
  returning id into new_profile_id;

  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    markets_and_languages, sources, warnings, provenance, created_by
  ) values (
    target_workspace_id,
    new_profile_id,
    1,
    target_workspace.name,
    target_workspace.website_url,
    '',
    array[target_workspace.default_locale],
    case
      when target_workspace.website_url is null then '{}'::text[]
      else array[target_workspace.website_url]
    end,
    array[
      'Products and services are missing.',
      'No approved proof points have been recorded.'
    ],
    'workspace',
    target_workspace.created_by
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public;
revoke all on function public.clear_workspace_data(uuid) from anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;
