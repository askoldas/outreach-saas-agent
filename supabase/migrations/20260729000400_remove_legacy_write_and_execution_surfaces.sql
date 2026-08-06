-- WP-23.3: remove executable V1 constructors and rollout-era switching.
-- Historical tables and rows remain intact for read models and exports.

drop function if exists public.save_clean_company_profile_version(
  uuid, jsonb, jsonb, jsonb, text
);
drop function if exists public.save_analyzed_company_profile_version(
  uuid, uuid, jsonb, jsonb, jsonb, text
);
drop function if exists public.save_clean_campaign_strategy_version(
  uuid, text, jsonb
);
drop function if exists public.create_clean_campaign(
  uuid, jsonb, jsonb
);
drop function if exists public.create_campaign_strategy_v2_draft(
  uuid, text, uuid, jsonb, text, jsonb, text
);
drop function if exists public.enable_workspace_controlled_beta_v2(
  uuid, boolean, text
);
drop function if exists public.rollback_workspace_intelligence_v2(
  uuid, text
);

-- Keep the stable application-facing RPC name, but retire its V1 provider
-- execution side effect. A native V2 Trigger run owns discovery execution.
create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_campaign public.campaigns;
  target_profile_intelligence_version text;
  created_run public.campaign_runs;
  frozen_contract_versions jsonb;
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
  if target_campaign.workflow_version <> 'v2' then
    raise exception
      'Historical V1 Campaigns are read-only and cannot create new runs'
      using errcode = '55000';
  end if;
  if target_campaign.current_strategy_version_id is null then
    raise exception 'Campaign Strategy is required';
  end if;
  if target_campaign.profile_snapshot_id is null then
    raise exception 'Campaign Profile snapshot is required';
  end if;

  select profile_version.intelligence_version
  into target_profile_intelligence_version
  from public.campaign_profile_snapshots snapshot
  join public.company_profile_versions profile_version
    on profile_version.id = snapshot.company_profile_version_id
  where snapshot.workspace_id = target_workspace_id
    and snapshot.id = target_campaign.profile_snapshot_id;

  if target_profile_intelligence_version is null then
    raise exception 'Campaign Profile intelligence version is missing';
  end if;

  frozen_contract_versions := jsonb_build_object(
    'profileIntelligence', target_profile_intelligence_version,
    'campaignIntelligence', target_campaign.intelligence_version,
    'campaignWorkflow', target_campaign.workflow_version
  );

  insert into public.campaign_runs (
    workspace_id,
    campaign_id,
    strategy_version_id,
    profile_snapshot_id,
    workflow_version,
    contract_versions,
    status,
    current_phase,
    progress_percentage,
    dispatch_state,
    metadata
  ) values (
    target_workspace_id,
    target_campaign.id,
    target_campaign.current_strategy_version_id,
    target_campaign.profile_snapshot_id,
    'v2',
    frozen_contract_versions,
    'queued',
    'discovery_queued',
    0,
    'created',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1),
      'workflowVersion',
      'v2'
    )
  )
  returning * into created_run;

  update public.campaign_runs
  set dispatch_key = 'execute-campaign-v2:' || created_run.id::text
  where id = created_run.id
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
    'Native V2 campaign discovery was queued.',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1),
      'workflowVersion',
      'v2',
      'contractVersions',
      frozen_contract_versions
    )
  );

  return created_run;
end;
$$;

revoke all on function public.create_clean_campaign_run(uuid, text, integer)
  from public, anon;
grant execute on function public.create_clean_campaign_run(uuid, text, integer)
  to authenticated;

create or replace function public.reject_retired_provider_execution()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.operation in ('company_profile_analysis', 'campaign_discovery') then
    raise exception
      'Legacy provider operation "%" is retired; use the native V2 workflow.',
      new.operation
      using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists provider_executions_reject_retired_operations
  on public.provider_executions;
create trigger provider_executions_reject_retired_operations
before insert on public.provider_executions
for each row execute function public.reject_retired_provider_execution();

revoke all on function public.reject_retired_provider_execution()
  from public, anon, authenticated;
