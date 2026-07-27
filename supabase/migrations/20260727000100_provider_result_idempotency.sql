alter table public.company_profile_versions
  add column analysis_execution_id uuid
  references public.provider_executions(id) on delete set null;

create unique index company_profile_versions_analysis_execution_unique
  on public.company_profile_versions(analysis_execution_id)
  where analysis_execution_id is not null;

alter table public.provider_executions
  add constraint provider_executions_logical_operation_unique
  unique (workspace_id, operation, idempotency_key);

create unique index ai_requests_logical_status_unique
  on public.ai_requests(provider_execution_id, role, request_hash, status);

create or replace function public.save_analyzed_company_profile_version(
  target_workspace_id uuid,
  analysis_execution_id_value uuid,
  profile_data jsonb,
  facts_data jsonb default '[]'::jsonb,
  questions_data jsonb default '[]'::jsonb,
  provenance_value text default 'website_analysis'
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
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into saved
  from public.company_profile_versions
  where analysis_execution_id = analysis_execution_id_value;

  if saved.id is not null then
    return saved;
  end if;

  select * into profile_root
  from public.company_profiles
  where workspace_id = target_workspace_id
  for update;

  if profile_root.id is null then
    raise exception 'Company Profile not found';
  end if;

  insert into public.company_profile_versions (
    workspace_id,
    company_profile_id,
    version,
    company_name,
    website_url,
    summary,
    structured_profile,
    extracted_facts,
    review_questions,
    profile_status,
    readiness_score,
    provenance,
    analysis_execution_id,
    created_by
  ) values (
    target_workspace_id,
    profile_root.id,
    coalesce((
      select max(version)
      from public.company_profile_versions
      where company_profile_id = profile_root.id
    ), 0) + 1,
    coalesce(profile_data->>'name', ''),
    nullif(profile_data->>'websiteUrl', ''),
    coalesce(profile_data->>'shortOverview', ''),
    profile_data,
    facts_data,
    questions_data,
    coalesce(profile_data->>'status', 'draft'),
    coalesce((profile_data#>>'{readiness,overall}')::integer, 0),
    provenance_value,
    analysis_execution_id_value,
    auth.uid()
  )
  returning * into saved;

  update public.company_profiles
  set current_version_id = saved.id
  where id = profile_root.id;

  return saved;
end;
$$;

revoke all on function public.save_analyzed_company_profile_version(
  uuid,uuid,jsonb,jsonb,jsonb,text
) from public, anon, authenticated;
grant execute on function public.save_analyzed_company_profile_version(
  uuid,uuid,jsonb,jsonb,jsonb,text
) to service_role;
