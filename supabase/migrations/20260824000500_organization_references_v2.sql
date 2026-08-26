-- Immutable Organization References bridge provider records and canonical resolution.

create table public.organization_references_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  normalized_candidate_id uuid not null
    references public.normalized_provider_candidates(id) on delete restrict,
  provider_source_record_id uuid not null
    references public.provider_source_records(id) on delete restrict,
  provider_execution_id uuid not null
    references public.discovery_provider_executions(id) on delete restrict,
  source_expansion_reference_id uuid
    references public.discovery_source_organization_references_v2(id) on delete restrict,
  reference_json jsonb not null check (jsonb_typeof(reference_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (normalized_candidate_id),
  unique (workspace_id, id)
);

create index organization_references_v2_campaign_idx
  on public.organization_references_v2(workspace_id, campaign_id, created_at, id);

create or replace function public.validate_organization_reference_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.normalized_provider_candidates candidate
    join public.provider_source_records source_record
      on source_record.id = candidate.provider_source_record_id
    join public.discovery_provider_executions execution
      on execution.id = source_record.provider_execution_id
    where candidate.id = new.normalized_candidate_id
      and candidate.workspace_id = new.workspace_id
      and candidate.campaign_id = new.campaign_id
      and source_record.id = new.provider_source_record_id
      and source_record.workspace_id = new.workspace_id
      and source_record.campaign_id = new.campaign_id
      and execution.id = new.provider_execution_id
      and execution.workspace_id = new.workspace_id
      and execution.campaign_id = new.campaign_id
  ) then
    raise exception 'Organization Reference source lineage mismatch.';
  end if;
  if new.reference_json->>'id' is distinct from new.id::text
    or new.reference_json->>'workspaceId' is distinct from new.workspace_id::text
    or new.reference_json->>'campaignId' is distinct from new.campaign_id::text
    or new.reference_json->>'sourceRecordId' is distinct from new.provider_source_record_id::text
    or new.reference_json->>'providerExecutionId' is distinct from new.provider_execution_id::text
  then
    raise exception 'Organization Reference payload identity mismatch.';
  end if;
  return new;
end;
$$;

create trigger organization_references_v2_workspace_guard
before insert on public.organization_references_v2
for each row execute function public.validate_organization_reference_v2();

create trigger organization_references_v2_immutable
before update or delete on public.organization_references_v2
for each row execute function public.reject_discovery_provider_update();

alter table public.organization_references_v2 enable row level security;
create policy organization_references_v2_select
  on public.organization_references_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

revoke all on public.organization_references_v2 from anon, authenticated;
grant select on public.organization_references_v2 to authenticated;

create or replace function public.materialize_campaign_organization_references_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare campaign_run public.campaign_runs;
declare discovery_run public.discovery_runs_v2;
declare candidate record;
declare reference_id uuid;
declare reference_payload jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  select * into campaign_run from public.campaign_runs
  where id = target_campaign_run_id and workspace_id = target_workspace_id
    and workflow_version = 'v2';
  if campaign_run.id is null then raise exception 'V2 Campaign Run not found.'; end if;
  select * into discovery_run from public.discovery_runs_v2
  where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and status in ('completed', 'stopped_budget', 'stopped_user');
  if discovery_run.id is null then raise exception 'Completed Semantic Discovery Run not found.'; end if;

  for candidate in
    select normalized.*, source_record.provider_execution_id,
      source_record.source_type as provider_source_type,
      source_record.source_url as provider_source_url,
      source_record.query_or_filter_fingerprint,
      source_record.retrieved_at,
      source_record.raw_payload_json->>'pageType' as source_page_type,
      execution.provider_key,
      source_reference.id as source_reference_id,
      source_reference.source_url as expansion_source_url,
      source_reference.extraction_method,
      source_reference.extraction_version,
      source_reference.source_ordinal
    from public.normalized_provider_candidates normalized
    join public.provider_source_records source_record
      on source_record.id = normalized.provider_source_record_id
    join public.discovery_provider_executions execution
      on execution.id = source_record.provider_execution_id
    join public.discovery_segment_runs_v2 segment_run
      on segment_run.id = execution.discovery_segment_run_id
    left join public.discovery_source_organization_references_v2 source_reference
      on source_reference.id = normalized.discovery_source_reference_id
    where segment_run.discovery_run_id = discovery_run.id
      and normalized.workspace_id = target_workspace_id
      and normalized.campaign_id = campaign_run.campaign_id
    order by normalized.id
  loop
    if exists (
      select 1 from public.organization_references_v2 existing
      where existing.normalized_candidate_id = candidate.id
    ) then continue; end if;
    reference_id := gen_random_uuid();
    reference_payload := jsonb_strip_nulls(jsonb_build_object(
      'id', reference_id,
      'workspaceId', target_workspace_id,
      'campaignId', campaign_run.campaign_id,
      'sourceRecordId', candidate.provider_source_record_id,
      'providerExecutionId', candidate.provider_execution_id,
      'providerId', candidate.provider_key,
      'sourceType', candidate.provider_source_type,
      'sourceUrl', coalesce(candidate.expansion_source_url, candidate.provider_source_url),
      'sourceRoles', case
        when candidate.source_page_type in ('company_homepage', 'company_subpage')
          then jsonb_build_array('discovery', 'identity', 'first_party')
        else jsonb_build_array('discovery') end,
      'organizationName', candidate.name,
      'normalizedName', candidate.normalized_name,
      'websiteHint', case
        when candidate.website_url is not null and candidate.website_url is distinct from
          coalesce(candidate.expansion_source_url, candidate.provider_source_url)
          then candidate.website_url
        when candidate.source_page_type in ('company_homepage', 'company_subpage')
          then candidate.website_url
        else null end,
      'domainHint', candidate.canonical_domain_hint,
      'geographyHints', to_jsonb(array_remove(array[
        candidate.country, candidate.region, candidate.locality
      ], null)),
      'organizationTypeHints', case when candidate.organization_type_hint is null
        then '[]'::jsonb else jsonb_build_array(candidate.organization_type_hint) end,
      'businessTypeHints', coalesce(candidate.industries_json, '[]'::jsonb),
      'matchedArchetypeIds', jsonb_build_array(candidate.matched_archetype_key),
      'matchedSegmentIds', jsonb_build_array(candidate.matched_segment_key),
      'matchedSignals', coalesce(candidate.matched_signals_json, '[]'::jsonb),
      'provenance', jsonb_strip_nulls(jsonb_build_object(
        'extractionMethod', coalesce(candidate.extraction_method, 'provider_normalization'),
        'extractionVersion', coalesce(
          candidate.extraction_version, candidate.normalization_version
        ),
        'sourceOrdinal', candidate.source_ordinal,
        'queryFingerprint', candidate.query_or_filter_fingerprint,
        'retrievedAt', candidate.retrieved_at
      )),
      'confidence', least(1, greatest(0, coalesce(
        (candidate.preliminary_quality_json->>'confidence')::numeric, 0
      )))
    ));
    insert into public.organization_references_v2 (
      id, workspace_id, campaign_id, normalized_candidate_id,
      provider_source_record_id, provider_execution_id,
      source_expansion_reference_id, reference_json
    ) values (
      reference_id, target_workspace_id, campaign_run.campaign_id, candidate.id,
      candidate.provider_source_record_id, candidate.provider_execution_id,
      candidate.source_reference_id, reference_payload
    ) on conflict (normalized_candidate_id) do nothing;
  end loop;

  return coalesce((
    select jsonb_agg(reference.reference_json order by reference.created_at, reference.id)
    from public.organization_references_v2 reference
    join public.normalized_provider_candidates normalized
      on normalized.id = reference.normalized_candidate_id
    join public.provider_source_records source_record
      on source_record.id = reference.provider_source_record_id
    join public.discovery_provider_executions execution
      on execution.id = source_record.provider_execution_id
    join public.discovery_segment_runs_v2 segment_run
      on segment_run.id = execution.discovery_segment_run_id
    where segment_run.discovery_run_id = discovery_run.id
      and reference.workspace_id = target_workspace_id
      and reference.campaign_id = campaign_run.campaign_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.materialize_campaign_organization_references_v2(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.materialize_campaign_organization_references_v2(uuid,uuid)
  to service_role;
