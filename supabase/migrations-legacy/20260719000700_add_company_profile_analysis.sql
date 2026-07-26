alter table public.company_profile_versions
  add column analysis_run_id uuid references public.research_runs(id) on delete set null,
  add column prompt_version text;

create index company_profile_versions_analysis_run_idx
on public.company_profile_versions(analysis_run_id);

create or replace function public.save_analyzed_company_profile_version(
  target_workspace_id uuid,
  target_run_id uuid,
  profile_data jsonb,
  target_prompt_version text
)
returns public.company_profile_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.company_profiles;
  next_version int;
  saved_version public.company_profile_versions;
begin
  if not exists (
    select 1 from public.research_runs
    where id = target_run_id and workspace_id = target_workspace_id
      and campaign_id = 'company-profile'
  ) then raise exception 'Company Profile analysis run not found'; end if;
  select * into target_profile from public.company_profiles
  where workspace_id = target_workspace_id for update;
  if target_profile.id is null then raise exception 'Company Profile not found'; end if;
  next_version := target_profile.current_version + 1;
  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    products_and_services, capabilities, customer_types, differentiators,
    proof_points, markets_and_languages, claims, limitations, sources, warnings,
    provenance, analysis_run_id, prompt_version
  ) values (
    target_workspace_id, target_profile.id, next_version,
    trim(coalesce(profile_data->>'companyName', '')),
    nullif(trim(coalesce(profile_data->>'website', '')), ''),
    coalesce(profile_data->>'summary', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'productsAndServices', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'capabilities', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'customerTypes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'differentiators', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'proofPoints', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'marketsAndLanguages', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'claims', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'limitations', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'sources', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'warnings', '[]'::jsonb))), '{}'),
    'website_analysis', target_run_id, target_prompt_version
  ) returning * into saved_version;
  update public.company_profiles set current_version = next_version where id = target_profile.id;
  return saved_version;
end;
$$;

revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from public;
revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from anon;
revoke all on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) from authenticated;
grant execute on function public.save_analyzed_company_profile_version(uuid, uuid, jsonb, text) to service_role;
