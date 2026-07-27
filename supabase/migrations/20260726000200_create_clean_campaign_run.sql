create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  created_run public.campaign_runs;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into target_campaign
  from public.campaigns
  where workspace_id = target_workspace_id
    and external_id = target_campaign_external_id
  for update;

  if target_campaign.id is null then
    raise exception 'Campaign not found';
  end if;
  if target_campaign.current_strategy_version_id is null then
    raise exception 'Campaign Strategy is required';
  end if;
  if target_campaign.profile_snapshot_id is null then
    raise exception 'Campaign Profile snapshot is required';
  end if;

  insert into public.campaign_runs (
    workspace_id,
    campaign_id,
    strategy_version_id,
    profile_snapshot_id,
    status,
    current_phase,
    progress_percentage,
    metadata
  ) values (
    target_workspace_id,
    target_campaign.id,
    target_campaign.current_strategy_version_id,
    target_campaign.profile_snapshot_id,
    'queued',
    'discovery_queued',
    0,
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  )
  returning * into created_run;

  update public.campaign_strategy_versions
  set status = 'used'
  where id = target_campaign.current_strategy_version_id
    and status in ('draft', 'ready');

  insert into public.campaign_run_events (
    workspace_id,
    campaign_run_id,
    event_type,
    phase,
    summary,
    details
  ) values (
    target_workspace_id,
    created_run.id,
    'campaign_run_queued',
    'discovery_queued',
    'Campaign discovery was queued.',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  );

  return created_run;
end;
$$;

revoke all on function public.create_clean_campaign_run(uuid,text,integer) from public, anon;
grant execute on function public.create_clean_campaign_run(uuid,text,integer) to authenticated;
