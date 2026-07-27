create or replace function public.save_analyzed_company_profile_version_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  structured_profile_data jsonb,
  facts_data jsonb,
  questions_data jsonb,
  target_prompt_version text
)
returns public.company_profile_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_profile public.company_profiles;
  target_run public.research_runs;
  next_version int;
  saved_version public.company_profile_versions;
begin
  select * into target_run from public.research_runs
  where id = target_run_id and workspace_id = target_workspace_id;
  if target_run.id is null then raise exception 'Analysis run not found'; end if;

  if jsonb_typeof(structured_profile_data) <> 'object'
    or coalesce(structured_profile_data->>'schemaVersion', '') <> '2' then
    raise exception 'Validated structured Company Profile v2 is required (type %, schemaVersion %)',
      coalesce(jsonb_typeof(structured_profile_data), 'null'),
      coalesce(structured_profile_data->>'schemaVersion', 'missing');
  end if;
  if jsonb_typeof(facts_data) <> 'array' or jsonb_typeof(questions_data) <> 'array' then
    raise exception 'Analyzed facts and review questions must be arrays';
  end if;

  select * into target_profile from public.company_profiles
  where workspace_id = target_workspace_id for update;
  if target_profile.id is null then raise exception 'Company Profile not found'; end if;
  next_version := target_profile.current_version + 1;

  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    products_and_services, capabilities, customer_types, differentiators,
    proof_points, markets_and_languages, claims, limitations, sources, warnings,
    provenance, analysis_run_id, analysis_prompt_version, structured_profile,
    extracted_facts, review_questions, profile_status, readiness_score
  ) values (
    target_workspace_id, target_profile.id, next_version,
    trim(structured_profile_data->>'name'),
    nullif(trim(structured_profile_data->>'websiteUrl'), ''),
    coalesce(structured_profile_data->>'shortOverview', ''),
    coalesce(array(
      select item->>'name'
      from jsonb_array_elements(coalesce(structured_profile_data->'offerings', '[]')) item
      where item->>'status' <> 'excluded'
    ), '{}'),
    coalesce(array(
      select item->>'name'
      from jsonb_array_elements(coalesce(structured_profile_data->'capabilities', '[]')) item
    ), '{}'),
    coalesce(array(
      select distinct customer_type.value
      from jsonb_array_elements(coalesce(structured_profile_data->'offerings', '[]')) item
      cross join lateral jsonb_array_elements_text(
        coalesce(item->'targetCustomerTypes', '[]')
      ) as customer_type(value)
    ), '{}'),
    '{}',
    coalesce(array(
      select item->>'title'
      from jsonb_array_elements(coalesce(structured_profile_data->'companyProof', '[]')) item
    ), '{}'),
    coalesce(array(
      select market.value
      from jsonb_array_elements_text(
        coalesce(structured_profile_data->'operatingMarkets', '[]')
      ) as market(value)
    ), '{}') || coalesce(array(
      select language.value
      from jsonb_array_elements_text(
        coalesce(structured_profile_data->'supportedLanguages', '[]')
      ) as language(value)
    ), '{}'),
    coalesce(array(
      select claim.value
      from jsonb_array_elements_text(
        coalesce(structured_profile_data#>'{communicationRules,approvedClaims}', '[]')
      ) as claim(value)
    ), '{}'),
    coalesce(array(
      select distinct constraint_item.value
      from jsonb_array_elements(coalesce(structured_profile_data->'offerings', '[]')) item
      cross join lateral jsonb_array_elements_text(
        coalesce(item->'commercialConstraints', '[]')
      ) as constraint_item(value)
    ), '{}'),
    coalesce(array(
      select item->>'url'
      from jsonb_array_elements(
        coalesce(structured_profile_data#>'{research,sources}', '[]')
      ) item where item ? 'url'
    ), '{}'),
    coalesce(array(
      select question->>'title'
      from jsonb_array_elements(questions_data) question
      where question->>'status' = 'unanswered'
    ), '{}'),
    'website_analysis', target_run_id, target_prompt_version,
    structured_profile_data, facts_data, questions_data,
    coalesce(structured_profile_data->>'status', 'draft'),
    coalesce((structured_profile_data#>>'{readiness,overall}')::int, 0)
  ) returning * into saved_version;

  update public.company_profiles
  set current_version = next_version, status = saved_version.profile_status
  where id = target_profile.id;
  return saved_version;
end;
$$;

revoke all on function public.save_analyzed_company_profile_version_v2(uuid, uuid, jsonb, jsonb, jsonb, text) from public;
revoke all on function public.save_analyzed_company_profile_version_v2(uuid, uuid, jsonb, jsonb, jsonb, text) from anon;
revoke all on function public.save_analyzed_company_profile_version_v2(uuid, uuid, jsonb, jsonb, jsonb, text) from authenticated;
grant execute on function public.save_analyzed_company_profile_version_v2(uuid, uuid, jsonb, jsonb, jsonb, text) to service_role;
