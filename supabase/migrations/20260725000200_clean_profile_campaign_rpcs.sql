create or replace function public.save_clean_company_profile_version(
  target_workspace_id uuid,
  profile_data jsonb,
  facts_data jsonb default '[]'::jsonb,
  questions_data jsonb default '[]'::jsonb,
  provenance_value text default 'manual'
)
returns public.company_profile_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_root public.company_profiles;
  saved public.company_profile_versions;
begin
  if auth.role() <> 'service_role' and not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select * into profile_root from public.company_profiles where workspace_id = target_workspace_id for update;
  if profile_root.id is null then raise exception 'Company Profile not found'; end if;
  insert into public.company_profile_versions (
    workspace_id, company_profile_id, version, company_name, website_url, summary,
    structured_profile, extracted_facts, review_questions, profile_status,
    readiness_score, provenance, created_by
  ) values (
    target_workspace_id, profile_root.id,
    coalesce((select max(version) from public.company_profile_versions where company_profile_id = profile_root.id), 0) + 1,
    coalesce(profile_data->>'name', ''), nullif(profile_data->>'websiteUrl', ''),
    coalesce(profile_data->>'shortOverview', ''), profile_data, facts_data, questions_data,
    coalesce(profile_data->>'status', 'draft'),
    coalesce((profile_data#>>'{readiness,overall}')::integer, 0),
    provenance_value, auth.uid()
  ) returning * into saved;
  update public.company_profiles set current_version_id = saved.id where id = profile_root.id;
  return saved;
end;
$$;

create or replace function public.save_clean_campaign_strategy_version(
  target_workspace_id uuid,
  target_campaign_external_id text,
  strategy_data jsonb
)
returns public.campaign_strategy_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  saved public.campaign_strategy_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into target_campaign from public.campaigns
    where workspace_id = target_workspace_id and external_id = target_campaign_external_id for update;
  if target_campaign.id is null then raise exception 'Campaign not found'; end if;
  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, strategy, created_by
  ) values (
    target_workspace_id, target_campaign.id,
    coalesce((select max(version) from public.campaign_strategy_versions where campaign_id = target_campaign.id), 0) + 1,
    coalesce(strategy_data->>'status', 'ready'), strategy_data, auth.uid()
  ) returning * into saved;
  update public.campaigns set current_strategy_version_id = saved.id where id = target_campaign.id;
  return saved;
end;
$$;

create or replace function public.create_clean_campaign(
  target_workspace_id uuid,
  campaign_data jsonb,
  initial_strategy jsonb
)
returns public.campaigns
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_root public.company_profiles;
  profile_version public.company_profile_versions;
  created public.campaigns;
  snapshot public.campaign_profile_snapshots;
  strategy public.campaign_strategy_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden' using errcode = '42501'; end if;
  select * into profile_root from public.company_profiles where workspace_id = target_workspace_id;
  select * into profile_version from public.company_profile_versions where id = profile_root.current_version_id;
  if profile_version.id is null then raise exception 'Published Company Profile is required'; end if;
  insert into public.campaigns (
    workspace_id, external_id, name, objective, selected_offering_id, target_geography,
    initial_target_description, industries, company_characteristics, relevant_use_case,
    exclusions, target_volume, preferred_outreach_language, status, approval_settings,
    created_by
  ) values (
    target_workspace_id, campaign_data->>'externalId', campaign_data->>'name',
    campaign_data->>'objective', nullif(campaign_data->>'selectedOfferingId', ''),
    coalesce(campaign_data->>'geography', ''), coalesce(campaign_data->>'targetDescription', ''),
    coalesce(array(select jsonb_array_elements_text(campaign_data->'industries')), '{}'),
    coalesce(array(select jsonb_array_elements_text(campaign_data->'characteristics')), '{}'),
    coalesce(campaign_data->>'relevantUseCase', ''),
    coalesce(array(select jsonb_array_elements_text(campaign_data->'exclusions')), '{}'),
    coalesce((campaign_data->>'targetVolume')::integer, 25),
    coalesce(campaign_data->>'language', 'English'), 'planning',
    coalesce(campaign_data->'approvalSettings', '{}'::jsonb), auth.uid()
  ) returning * into created;
  insert into public.campaign_profile_snapshots (
    workspace_id, campaign_id, company_profile_version_id, snapshot_data
  ) values (
    target_workspace_id, created.id, profile_version.id, profile_version.structured_profile
  ) returning * into snapshot;
  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, strategy, created_by
  ) values (target_workspace_id, created.id, 1, 'ready', initial_strategy, auth.uid())
  returning * into strategy;
  update public.campaigns set profile_snapshot_id = snapshot.id,
    current_strategy_version_id = strategy.id where id = created.id returning * into created;
  return created;
end;
$$;

revoke all on function public.save_clean_company_profile_version(uuid,jsonb,jsonb,jsonb,text) from public, anon;
revoke all on function public.save_clean_campaign_strategy_version(uuid,text,jsonb) from public, anon;
revoke all on function public.create_clean_campaign(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.save_clean_company_profile_version(uuid,jsonb,jsonb,jsonb,text) to authenticated;
grant execute on function public.save_clean_campaign_strategy_version(uuid,text,jsonb) to authenticated;
grant execute on function public.create_clean_campaign(uuid,jsonb,jsonb) to authenticated;
