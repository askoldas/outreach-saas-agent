do $$
declare readiness jsonb;
begin
  readiness := public.legacy_retirement_readiness();
  if coalesce((readiness->>'ready')::boolean, false) is not true then
    raise exception 'Legacy schema retirement blocked by readiness audit: %', readiness;
  end if;
end;
$$;

create or replace function public.create_initial_campaign_strategy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare strategy_id uuid;
begin
  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, target_geography, company_types,
    industries, relevance_reasons, opportunity_assumptions, contact_roles,
    contact_departments, acceptable_contact_routes, search_languages,
    target_company_count, created_by
  ) values (
    new.workspace_id, new.id, 1, 'ready', new.geography, new.target_segments,
    coalesce(new.industry_terms, '{}'), array[new.objective],
    array['Commercial relevance requires evidence during research'],
    array['Relevant decision-maker'], array['Purchasing', 'Partnerships'],
    array['Named business contact', 'Department email', 'General business route'],
    array[new.language], coalesce(new.desired_lead_count, greatest(new.lead_count, 25)),
    auth.uid()
  ) returning id into strategy_id;
  update public.campaigns set current_strategy_version_id = strategy_id where id = new.id;
  return new;
end;
$$;

create or replace function public.save_campaign_strategy_version(
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
  next_version int;
  saved_version public.campaign_strategy_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required';
  end if;
  select * into target_campaign from public.campaigns
  where workspace_id = target_workspace_id and external_id = target_campaign_external_id
  for update;
  if target_campaign.id is null then raise exception 'Campaign not found'; end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.campaign_strategy_versions where campaign_id = target_campaign.id;
  update public.campaign_strategy_versions set status = 'superseded'
  where campaign_id = target_campaign.id and status in ('draft', 'ready');
  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, target_geography, company_types,
    industries, characteristics, relevance_reasons, opportunity_assumptions,
    qualification_criteria, positive_signals, exclusions, contact_roles,
    contact_departments, acceptable_contact_routes, search_languages,
    source_categories, search_terms, localized_terms, limitations,
    target_company_count, refinement_summary, created_by
  ) values (
    target_workspace_id, target_campaign.id, next_version, 'ready',
    coalesce(strategy_data->>'targetGeography', target_campaign.geography),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'companyTypes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'industries', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'characteristics', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'relevanceReasons', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'opportunityAssumptions', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'qualificationCriteria', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'positiveSignals', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'exclusions', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'contactRoles', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'contactDepartments', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'acceptableContactRoutes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'searchLanguages', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'sourceCategories', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'searchTerms', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'localizedTerms', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'limitations', '[]'::jsonb))), '{}'),
    greatest(coalesce((strategy_data->>'targetCompanyCount')::int, target_campaign.desired_lead_count, 25), 1),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'refinementSummary', '[]'::jsonb))), '{}'),
    auth.uid()
  ) returning * into saved_version;
  update public.campaigns set
    current_strategy_version_id = saved_version.id,
    geography = saved_version.target_geography,
    target_segments = saved_version.company_types,
    industry_terms = saved_version.industries,
    desired_lead_count = saved_version.target_company_count,
    last_activity_label = 'Strategy version saved'
  where id = target_campaign.id;
  return saved_version;
end;
$$;

drop function public.legacy_retirement_readiness();

alter table public.campaigns
  drop column offer_external_id,
  drop column strategy_terms,
  drop column strategy_localized_terms,
  drop column strategy_sources,
  drop column strategy_criteria,
  drop column strategy_exclusions,
  drop column strategy_limitations;

drop table public.offers;
