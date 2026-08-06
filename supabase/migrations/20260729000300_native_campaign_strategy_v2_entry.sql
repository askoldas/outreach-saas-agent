-- WP-23.2: create new campaigns and Campaign Strategy V2 drafts directly
-- from the canonical, published Company Intelligence V3 graph.

create or replace function public.create_native_campaign_v2(
  target_workspace_id uuid,
  campaign_data jsonb
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
  selected_offering_key text;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(campaign_data) is distinct from 'object'
    or campaign_data->>'entryContract' is distinct from 'native-campaign/v1'
    or nullif(trim(campaign_data->>'externalId'), '') is null
    or nullif(trim(campaign_data->>'name'), '') is null
    or nullif(trim(campaign_data->>'objective'), '') is null
    or jsonb_typeof(campaign_data->'industries') is distinct from 'array'
    or jsonb_typeof(campaign_data->'characteristics') is distinct from 'array'
    or jsonb_typeof(campaign_data->'exclusions') is distinct from 'array'
  then
    raise exception 'Invalid native Campaign input.';
  end if;

  select *
  into profile_root
  from public.company_profiles
  where workspace_id = target_workspace_id;

  select *
  into profile_version
  from public.company_profile_versions
  where workspace_id = target_workspace_id
    and id = profile_root.current_version_id
    and intelligence_version = 'v2'
    and profile_status = 'published';

  if profile_version.id is null
    or profile_version.structured_profile->>'schemaVersion' is distinct from '3'
    or profile_version.structured_profile #>> '{sourceSet,contractVersion}'
      is distinct from 'company-profile-source-set/v1'
    or profile_version.structured_profile #>> '{sourceSet,kind}'
      is distinct from 'official_website'
  then
    raise exception 'A published native Company Intelligence V3 profile is required.';
  end if;

  selected_offering_key := nullif(trim(campaign_data->>'selectedOfferingId'), '');
  if selected_offering_key is null or not exists (
    select 1
    from public.company_offerings offering
    join public.company_offering_versions offering_version
      on offering_version.company_offering_id = offering.id
     and offering_version.workspace_id = target_workspace_id
     and offering_version.profile_version_id = profile_version.id
     and offering_version.status = 'active'
    where offering.workspace_id = target_workspace_id
      and offering.company_profile_id = profile_root.id
      and offering.stable_key = selected_offering_key
      and offering.archived_at is null
  ) then
    raise exception 'The selected published offering is unavailable.';
  end if;

  insert into public.campaigns (
    workspace_id,
    external_id,
    name,
    objective,
    selected_offering_id,
    target_geography,
    initial_target_description,
    industries,
    company_characteristics,
    relevant_use_case,
    exclusions,
    target_volume,
    preferred_outreach_language,
    approval_settings,
    status,
    intelligence_version,
    workflow_version,
    created_by
  ) values (
    target_workspace_id,
    campaign_data->>'externalId',
    campaign_data->>'name',
    campaign_data->>'objective',
    selected_offering_key,
    coalesce(campaign_data->>'geography', ''),
    coalesce(campaign_data->>'targetDescription', ''),
    array(select jsonb_array_elements_text(campaign_data->'industries')),
    array(select jsonb_array_elements_text(campaign_data->'characteristics')),
    coalesce(campaign_data->>'relevantUseCase', ''),
    array(select jsonb_array_elements_text(campaign_data->'exclusions')),
    greatest(coalesce(nullif(campaign_data->>'targetVolume', '')::integer, 25), 1),
    coalesce(nullif(trim(campaign_data->>'language'), ''), 'English'),
    coalesce(campaign_data->'approvalSettings', '{}'::jsonb)
      || jsonb_build_object('entryContract', 'native-campaign/v1'),
    'planning',
    'v2',
    'v2',
    auth.uid()
  )
  returning * into created;

  insert into public.campaign_profile_snapshots (
    workspace_id,
    campaign_id,
    company_profile_version_id,
    snapshot_data
  ) values (
    target_workspace_id,
    created.id,
    profile_version.id,
    profile_version.structured_profile
  )
  returning * into snapshot;

  update public.campaigns
  set profile_snapshot_id = snapshot.id,
      updated_at = now()
  where id = created.id
  returning * into created;

  return created;
end;
$$;

create or replace function public.create_native_campaign_strategy_v2_draft(
  target_workspace_id uuid,
  target_campaign_external_id text,
  target_profile_version_id uuid,
  target_input jsonb,
  target_input_hash text,
  target_compiled_context jsonb,
  target_compiled_context_hash text
)
returns public.campaign_strategy_drafts
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  target_campaign public.campaigns;
  target_snapshot public.campaign_profile_snapshots;
  saved_input public.campaign_inputs;
  saved_draft public.campaign_strategy_drafts;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select *
  into target_campaign
  from public.campaigns
  where workspace_id = target_workspace_id
    and external_id = target_campaign_external_id
  for update;

  if target_campaign.id is null then
    raise exception 'Campaign not found.';
  end if;
  if target_campaign.workflow_version <> 'v2'
    or target_campaign.intelligence_version <> 'v2'
    or target_campaign.approval_settings->>'entryContract'
      is distinct from 'native-campaign/v1'
  then
    raise exception 'Campaign is not a native V2 campaign.';
  end if;

  select *
  into target_snapshot
  from public.campaign_profile_snapshots
  where workspace_id = target_workspace_id
    and id = target_campaign.profile_snapshot_id
    and company_profile_version_id = target_profile_version_id;

  if target_snapshot.id is null or not exists (
    select 1
    from public.company_profile_versions profile_version
    where profile_version.workspace_id = target_workspace_id
      and profile_version.id = target_profile_version_id
      and profile_version.intelligence_version = 'v2'
      and profile_version.profile_status = 'published'
      and profile_version.structured_profile->>'schemaVersion' = '3'
      and profile_version.structured_profile #>> '{sourceSet,contractVersion}'
        = 'company-profile-source-set/v1'
      and profile_version.structured_profile #>> '{sourceSet,kind}'
        = 'official_website'
  ) then
    raise exception 'Campaign profile snapshot is not native Company Intelligence V3.';
  end if;

  if jsonb_typeof(target_input) is distinct from 'object'
    or target_input->>'entryContract'
      is distinct from 'native-campaign-strategy/v1'
    or jsonb_typeof(target_input->'geography') is distinct from 'object'
    or jsonb_typeof(target_input->'objective') is distinct from 'object'
    or jsonb_typeof(target_input->'offeringReferences') is distinct from 'array'
    or jsonb_array_length(target_input->'offeringReferences') < 1
    or length(target_input_hash) is distinct from 64
    or length(target_compiled_context_hash) is distinct from 64
    or target_compiled_context->>'compilerVersion'
      is distinct from 'campaign-context/v2.1-native'
    or target_compiled_context->>'contextHash'
      is distinct from target_compiled_context_hash
  then
    raise exception 'Invalid native Campaign Strategy input.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_input->'offeringReferences') reference
    where reference->>'companyProfileVersionId'
        is distinct from target_profile_version_id::text
      or not exists (
        select 1
        from public.company_offering_versions offering_version
        join public.company_offerings offering
          on offering.id = offering_version.company_offering_id
         and offering.workspace_id = target_workspace_id
        where offering_version.workspace_id = target_workspace_id
          and offering_version.id = (reference->>'offeringVersionId')::uuid
          and offering_version.profile_version_id = target_profile_version_id
          and offering_version.status = 'active'
          and offering.id = (reference->>'offeringId')::uuid
          and offering.archived_at is null
      )
  ) then
    raise exception 'Campaign Strategy references an unavailable published offering.';
  end if;

  insert into public.campaign_inputs (
    workspace_id,
    campaign_id,
    geography_json,
    objective_json,
    offering_references_json,
    offer_variant_json,
    constraints_json,
    initial_hypothesis_json,
    requested_volume,
    input_hash,
    created_by_user_id
  ) values (
    target_workspace_id,
    target_campaign.id,
    target_input->'geography',
    target_input->'objective',
    target_input->'offeringReferences',
    target_input->'offerVariant',
    coalesce(target_input->'constraints', '[]'::jsonb),
    coalesce(target_input->'initialHypothesis', '{}'::jsonb),
    nullif(target_input->>'requestedVolume', '')::integer,
    target_input_hash,
    auth.uid()
  )
  on conflict (campaign_id, input_hash) do update
  set updated_at = public.campaign_inputs.updated_at
  returning * into saved_input;

  insert into public.campaign_strategy_drafts (
    workspace_id,
    campaign_id,
    campaign_input_id,
    base_strategy_version_id,
    profile_intelligence_version_id,
    state,
    contract_version,
    context_compiler_version,
    compiler_version,
    compiled_context_json,
    compiled_context_hash,
    created_by_user_id
  ) values (
    target_workspace_id,
    target_campaign.id,
    saved_input.id,
    target_campaign.current_strategy_version_id,
    target_profile_version_id,
    'building',
    'campaign-strategy/v2.0',
    'campaign-context/v2.1-native',
    'campaign-strategy/v2.1-native',
    target_compiled_context,
    target_compiled_context_hash,
    auth.uid()
  )
  on conflict (
    campaign_id,
    campaign_input_id,
    profile_intelligence_version_id,
    compiler_version
  ) do update
  set updated_at = public.campaign_strategy_drafts.updated_at
  returning * into saved_draft;

  update public.campaigns
  set current_strategy_draft_id = saved_draft.id,
      updated_at = now()
  where id = target_campaign.id;

  insert into public.campaign_strategy_events (
    workspace_id,
    campaign_id,
    campaign_strategy_draft_id,
    event_type,
    actor_type,
    actor_user_id,
    affected_paths,
    details_json
  ) values (
    target_workspace_id,
    target_campaign.id,
    saved_draft.id,
    'native_draft_created',
    'user',
    auth.uid(),
    array['objective', 'geography', 'offeringReferences'],
    jsonb_build_object(
      'entryContract',
      'native-campaign-strategy/v1',
      'inputHash',
      target_input_hash,
      'contextHash',
      target_compiled_context_hash
    )
  );

  return saved_draft;
end;
$$;

create or replace function public.require_native_campaign_strategy_for_native_campaign()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  campaign_entry_contract text;
begin
  select approval_settings->>'entryContract'
  into campaign_entry_contract
  from public.campaigns
  where id = new.campaign_id;

  if campaign_entry_contract = 'native-campaign/v1'
    and (
      jsonb_typeof(new.strategy) is distinct from 'object'
      or new.strategy->>'creationContract'
        is distinct from 'native-campaign-strategy/v1'
    )
  then
    raise exception 'Native V2 campaigns require a native Campaign Strategy.';
  end if;
  return new;
end;
$$;

drop trigger if exists campaign_strategy_versions_require_native_entry
on public.campaign_strategy_versions;
create trigger campaign_strategy_versions_require_native_entry
before insert on public.campaign_strategy_versions
for each row
execute function public.require_native_campaign_strategy_for_native_campaign();

revoke all on function public.create_native_campaign_v2(
  uuid, jsonb
) from public, anon;
grant execute on function public.create_native_campaign_v2(
  uuid, jsonb
) to authenticated;

revoke all on function public.create_native_campaign_strategy_v2_draft(
  uuid, text, uuid, jsonb, text, jsonb, text
) from public, anon;
grant execute on function public.create_native_campaign_strategy_v2_draft(
  uuid, text, uuid, jsonb, text, jsonb, text
) to authenticated, service_role;

-- Adapter-era constructors remain for immutable historical data only.
revoke all on function public.create_clean_campaign(
  uuid, jsonb, jsonb
) from authenticated, service_role;
revoke all on function public.create_campaign_strategy_v2_draft(
  uuid, text, uuid, jsonb, text, jsonb, text
) from authenticated, service_role;

revoke all on function
  public.require_native_campaign_strategy_for_native_campaign()
from public, anon, authenticated, service_role;
