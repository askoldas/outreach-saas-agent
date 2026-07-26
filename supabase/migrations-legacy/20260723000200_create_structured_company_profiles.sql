alter table public.company_profiles
  add column published_version int,
  add column status text not null default 'draft'
    check (status in ('draft', 'needs_input', 'ready', 'published'));

alter table public.company_profile_versions
  add column structured_profile jsonb,
  add column extracted_facts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extracted_facts) = 'array'),
  add column review_questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(review_questions) = 'array'),
  add column profile_status text not null default 'draft'
    check (profile_status in ('draft', 'needs_input', 'ready', 'published')),
  add column readiness_score int not null default 0
    check (readiness_score between 0 and 100),
  add column published_at timestamptz,
  add constraint company_profile_versions_structured_profile_object
    check (structured_profile is null or jsonb_typeof(structured_profile) = 'object');

alter table public.campaigns
  add column selected_offering_id text,
  add column offering_overrides jsonb not null default '{}'::jsonb
    check (jsonb_typeof(offering_overrides) = 'object');

alter table public.campaign_profile_snapshots
  add column selected_offering_id text;

create index campaigns_workspace_selected_offering_idx
on public.campaigns(workspace_id, selected_offering_id);

create or replace function public.save_structured_company_profile_version(
  target_workspace_id uuid,
  profile_data jsonb,
  facts_data jsonb default '[]'::jsonb,
  questions_data jsonb default '[]'::jsonb
)
returns public.company_profile_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_profile public.company_profiles;
  next_version int;
  saved_version public.company_profile_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(profile_data) <> 'object'
    or coalesce((profile_data->>'schemaVersion')::int, 0) <> 2 then
    raise exception 'Validated structured Company Profile v2 is required';
  end if;

  select * into target_profile from public.company_profiles
  where workspace_id = target_workspace_id for update;
  if target_profile.id is null then raise exception 'Company Profile not found'; end if;
  next_version := target_profile.current_version + 1;

  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    products_and_services, capabilities, customer_types, differentiators,
    proof_points, markets_and_languages, claims, limitations, sources, warnings,
    provenance, created_by, structured_profile, extracted_facts, review_questions,
    profile_status, readiness_score, published_at
  ) values (
    target_workspace_id, target_profile.id, next_version,
    trim(profile_data->>'name'), nullif(trim(profile_data->>'websiteUrl'), ''),
    coalesce(profile_data->>'shortOverview', ''),
    coalesce(array(select item->>'name' from jsonb_array_elements(coalesce(profile_data->'offerings', '[]')) item where item->>'status' <> 'excluded'), '{}'),
    coalesce(array(select item->>'name' from jsonb_array_elements(coalesce(profile_data->'capabilities', '[]')) item), '{}'),
    coalesce(array(select distinct value from jsonb_array_elements(coalesce(profile_data->'offerings', '[]')) item cross join lateral jsonb_array_elements_text(coalesce(item->'targetCustomerTypes', '[]')) value), '{}'),
    '{}',
    coalesce(array(select item->>'title' from jsonb_array_elements(coalesce(profile_data->'companyProof', '[]')) item), '{}'),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(profile_data->'operatingMarkets', '[]')) value), '{}') || coalesce(array(select value from jsonb_array_elements_text(coalesce(profile_data->'supportedLanguages', '[]')) value), '{}'),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(profile_data#>'{communicationRules,approvedClaims}', '[]')) value), '{}'),
    coalesce(array(select distinct value from jsonb_array_elements(coalesce(profile_data->'offerings', '[]')) item cross join lateral jsonb_array_elements_text(coalesce(item->'commercialConstraints', '[]')) value), '{}'),
    coalesce(array(select item->>'url' from jsonb_array_elements(coalesce(profile_data#>'{research,sources}', '[]')) item where item ? 'url'), '{}'),
    coalesce(array(select q->>'title' from jsonb_array_elements(questions_data) q where q->>'status' = 'unanswered'), '{}'),
    'manual', auth.uid(), profile_data, facts_data, questions_data,
    coalesce(profile_data->>'status', 'draft'),
    coalesce((profile_data#>>'{readiness,overall}')::int, 0),
    case when profile_data->>'status' = 'published' then now() else null end
  ) returning * into saved_version;

  update public.company_profiles
  set current_version = next_version,
      published_version = case when saved_version.profile_status = 'published' then next_version else published_version end,
      status = saved_version.profile_status
  where id = target_profile.id;
  return saved_version;
end;
$$;

revoke all on function public.save_structured_company_profile_version(uuid, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_structured_company_profile_version(uuid, jsonb, jsonb, jsonb) from anon;
grant execute on function public.save_structured_company_profile_version(uuid, jsonb, jsonb, jsonb) to authenticated;

create or replace function public.save_analyzed_company_profile_version(
  target_workspace_id uuid,
  target_run_id uuid,
  profile_data jsonb,
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
  facts_data jsonb := coalesce(profile_data->'facts', '[]'::jsonb);
  questions_data jsonb := coalesce(profile_data->'reviewQuestions', '[]'::jsonb);
  structured_data jsonb := profile_data->'profile';
begin
  select * into target_run from public.research_runs
  where id = target_run_id and workspace_id = target_workspace_id;
  if target_run.id is null then raise exception 'Analysis run not found'; end if;
  if jsonb_typeof(structured_data) <> 'object'
    or coalesce((structured_data->>'schemaVersion')::int, 0) <> 2 then
    raise exception 'Validated structured Company Profile v2 is required';
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
    trim(structured_data->>'name'), nullif(trim(structured_data->>'websiteUrl'), ''),
    coalesce(structured_data->>'shortOverview', ''),
    coalesce(array(select item->>'name' from jsonb_array_elements(coalesce(structured_data->'offerings', '[]')) item where item->>'status' <> 'excluded'), '{}'),
    coalesce(array(select item->>'name' from jsonb_array_elements(coalesce(structured_data->'capabilities', '[]')) item), '{}'),
    coalesce(array(select distinct value from jsonb_array_elements(coalesce(structured_data->'offerings', '[]')) item cross join lateral jsonb_array_elements_text(coalesce(item->'targetCustomerTypes', '[]')) value), '{}'),
    '{}',
    coalesce(array(select item->>'title' from jsonb_array_elements(coalesce(structured_data->'companyProof', '[]')) item), '{}'),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(structured_data->'operatingMarkets', '[]')) value), '{}') || coalesce(array(select value from jsonb_array_elements_text(coalesce(structured_data->'supportedLanguages', '[]')) value), '{}'),
    coalesce(array(select value from jsonb_array_elements_text(coalesce(structured_data#>'{communicationRules,approvedClaims}', '[]')) value), '{}'),
    coalesce(array(select distinct value from jsonb_array_elements(coalesce(structured_data->'offerings', '[]')) item cross join lateral jsonb_array_elements_text(coalesce(item->'commercialConstraints', '[]')) value), '{}'),
    coalesce(array(select item->>'url' from jsonb_array_elements(coalesce(structured_data#>'{research,sources}', '[]')) item where item ? 'url'), '{}'),
    coalesce(array(select q->>'title' from jsonb_array_elements(questions_data) q where q->>'status' = 'unanswered'), '{}'),
    'website_analysis', target_run_id, target_prompt_version, structured_data,
    facts_data, questions_data, coalesce(structured_data->>'status', 'draft'),
    coalesce((structured_data#>>'{readiness,overall}')::int, 0)
  ) returning * into saved_version;

  update public.company_profiles
  set current_version = next_version, status = saved_version.profile_status
  where id = target_profile.id;
  return saved_version;
end;
$$;

revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from public;
revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from anon;
revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from authenticated;
grant execute on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) to service_role;
