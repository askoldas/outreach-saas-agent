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
  target_geography text := trim(coalesce(strategy_data->>'targetGeography', ''));
  target_count integer := greatest(
    1,
    coalesce((strategy_data->>'targetCompanyCount')::integer, 25)
  );
  geography_values jsonb;
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

  if target_campaign.status = 'active' then
    raise exception 'Pause the active campaign run before adjusting its market';
  end if;

  if jsonb_typeof(strategy_data) <> 'object'
    or jsonb_typeof(strategy_data->'companyTypes') <> 'array'
    or jsonb_typeof(strategy_data->'industries') <> 'array'
    or jsonb_typeof(strategy_data->'characteristics') <> 'array'
    or jsonb_typeof(strategy_data->'positiveSignals') <> 'array'
    or jsonb_typeof(strategy_data->'qualificationCriteria') <> 'array'
    or jsonb_typeof(strategy_data->'exclusions') <> 'array'
    or jsonb_typeof(strategy_data->'contactRoles') <> 'array'
    or target_geography = ''
  then
    raise exception 'Invalid Campaign Strategy revision';
  end if;

  geography_values := to_jsonb(
    regexp_split_to_array(target_geography, '\s*[,;]\s*')
  );

  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, strategy, created_by
  ) values (
    target_workspace_id,
    target_campaign.id,
    coalesce((
      select max(version)
      from public.campaign_strategy_versions
      where campaign_id = target_campaign.id
    ), 0) + 1,
    coalesce(strategy_data->>'status', 'ready'),
    strategy_data,
    auth.uid()
  )
  returning * into saved;

  update public.campaigns
  set
    current_strategy_version_id = saved.id,
    target_geography = target_geography,
    industries = array(
      select jsonb_array_elements_text(strategy_data->'industries')
    ),
    company_characteristics = array(
      select jsonb_array_elements_text(strategy_data->'companyTypes')
    ),
    exclusions = array(
      select jsonb_array_elements_text(strategy_data->'exclusions')
    ),
    target_volume = target_count,
    preferred_outreach_language = coalesce(
      strategy_data->'searchLanguages'->>0,
      preferred_outreach_language
    ),
    updated_at = now()
  where id = target_campaign.id;

  update public.campaign_briefs
  set confirmed_brief =
    confirmed_brief ||
    jsonb_build_object(
      'geography',
      coalesce(confirmed_brief->'geography', '{}'::jsonb) ||
        jsonb_build_object(
          'countryCodes', geography_values,
          'regionLabel', target_geography,
          'primaryLanguage', coalesce(
            strategy_data->'searchLanguages'->>0,
            confirmed_brief->'geography'->>'primaryLanguage',
            'English'
          )
        ),
      'targetClient',
      coalesce(confirmed_brief->'targetClient', '{}'::jsonb) ||
        jsonb_build_object(
          'companyTypes', strategy_data->'companyTypes',
          'industries', strategy_data->'industries',
          'characteristics', strategy_data->'characteristics',
          'positiveSignals', strategy_data->'positiveSignals',
          'requiredCriteria', strategy_data->'qualificationCriteria',
          'exclusions', strategy_data->'exclusions',
          'recommendedDecisionMakerRoles', strategy_data->'contactRoles'
        ),
      'desiredQualifiedCompanies', target_count
    )
  where workspace_id = target_workspace_id
    and campaign_id = target_campaign.id;

  return saved;
end;
$$;

revoke all on function public.save_clean_campaign_strategy_version(uuid,text,jsonb)
  from public, anon;
grant execute on function public.save_clean_campaign_strategy_version(uuid,text,jsonb)
  to authenticated;
