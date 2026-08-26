-- Durable, retry-safe expansion of discovery-source pages into organization references.

create table public.discovery_source_expansions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider_execution_id uuid not null references public.discovery_provider_executions(id) on delete cascade,
  provider_source_record_id uuid not null references public.provider_source_records(id) on delete cascade,
  extraction_version text not null,
  status text not null check (status in ('partial', 'completed', 'failed')),
  next_offset integer check (next_offset is null or next_offset >= 0),
  total_organizations integer not null check (total_organizations >= 0),
  expanded_organizations integer not null check (expanded_organizations >= 0),
  source_family text not null,
  source_type text not null,
  query_fingerprint text not null,
  matched_segment_key text not null,
  matched_archetype_key text not null,
  extraction_method text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_source_record_id, extraction_version),
  unique (workspace_id, id)
);

create table public.discovery_source_organization_references_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  source_expansion_id uuid not null references public.discovery_source_expansions_v2(id) on delete cascade,
  provider_execution_id uuid not null references public.discovery_provider_executions(id) on delete cascade,
  provider_source_record_id uuid not null references public.provider_source_records(id) on delete cascade,
  reference_key text not null check (length(reference_key) = 64),
  organization_name text not null check (length(btrim(organization_name)) > 0),
  website_url text,
  canonical_domain_hint text,
  source_url text not null,
  source_family text not null,
  source_type text not null,
  query_fingerprint text not null,
  extraction_method text not null,
  extraction_version text not null,
  source_ordinal integer not null check (source_ordinal >= 0),
  created_at timestamptz not null default now(),
  unique (provider_source_record_id, extraction_version, reference_key),
  unique (workspace_id, id)
);

alter table public.normalized_provider_candidates
  add column candidate_reference_key text,
  add column discovery_source_reference_id uuid
    references public.discovery_source_organization_references_v2(id) on delete restrict;

do $$
declare prior_unique_constraint text;
begin
  select constraint_row.conname
  into prior_unique_constraint
  from pg_constraint constraint_row
  where constraint_row.conrelid = 'public.normalized_provider_candidates'::regclass
    and constraint_row.contype = 'u'
    and pg_get_constraintdef(constraint_row.oid) =
      'UNIQUE (provider_source_record_id, normalization_version)'
  limit 1;

  if prior_unique_constraint is null then
    raise exception 'Expected normalized provider candidate source/version uniqueness constraint was not found.';
  end if;

  execute format(
    'alter table public.normalized_provider_candidates drop constraint %I',
    prior_unique_constraint
  );
end;
$$;

alter table public.normalized_provider_candidates
  add constraint normalized_provider_candidates_source_reference_version_unique
  unique nulls not distinct (
    provider_source_record_id,
    normalization_version,
    candidate_reference_key
  );

create index discovery_source_expansions_pending_idx
  on public.discovery_source_expansions_v2(workspace_id, campaign_id, status, created_at)
  where status = 'partial';
create index discovery_source_references_identity_idx
  on public.discovery_source_organization_references_v2(
    workspace_id, campaign_id, canonical_domain_hint, organization_name
  );

create or replace function public.validate_discovery_source_expansion_workspace_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.provider_source_records source_record
    join public.discovery_provider_executions execution
      on execution.id = source_record.provider_execution_id
    where source_record.id = new.provider_source_record_id
      and source_record.workspace_id = new.workspace_id
      and source_record.campaign_id = new.campaign_id
      and execution.id = new.provider_execution_id
      and execution.workspace_id = new.workspace_id
      and execution.campaign_id = new.campaign_id
  ) then
    raise exception 'Cross-workspace discovery source expansion.';
  end if;
  if tg_table_name = 'discovery_source_organization_references_v2' and not exists (
    select 1 from public.discovery_source_expansions_v2 expansion
    where expansion.id = new.source_expansion_id
      and expansion.workspace_id = new.workspace_id
      and expansion.campaign_id = new.campaign_id
      and expansion.provider_execution_id = new.provider_execution_id
      and expansion.provider_source_record_id = new.provider_source_record_id
  ) then
    raise exception 'Cross-workspace discovery source reference.';
  end if;
  return new;
end;
$$;

create trigger discovery_source_expansions_v2_workspace_guard
before insert or update on public.discovery_source_expansions_v2
for each row execute function public.validate_discovery_source_expansion_workspace_v2();

create trigger discovery_source_references_v2_workspace_guard
before insert or update on public.discovery_source_organization_references_v2
for each row execute function public.validate_discovery_source_expansion_workspace_v2();

create trigger discovery_source_references_v2_immutable
before update on public.discovery_source_organization_references_v2
for each row execute function public.reject_discovery_provider_update();

alter table public.discovery_source_expansions_v2 enable row level security;
alter table public.discovery_source_organization_references_v2 enable row level security;

create policy "Members can read discovery source expansions v2"
on public.discovery_source_expansions_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));
create policy "Members can read discovery source references v2"
on public.discovery_source_organization_references_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.persist_discovery_source_expansion_v2(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_provider_execution_id uuid,
  target_provider_source_record_id uuid,
  target_normalization_version text,
  target_segment_key text,
  target_archetype_key text,
  target_page jsonb,
  target_source_family text,
  target_source_type text,
  target_query_fingerprint text,
  target_created_at timestamptz
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare saved_expansion public.discovery_source_expansions_v2;
declare saved_reference public.discovery_source_organization_references_v2;
declare organization jsonb;
declare expanded_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  if jsonb_typeof(target_page->'organizations') is distinct from 'array' then
    raise exception 'Discovery source expansion organizations must be an array.';
  end if;

  insert into public.discovery_source_expansions_v2 (
    workspace_id, campaign_id, provider_execution_id, provider_source_record_id,
    extraction_version, status, next_offset, total_organizations,
    expanded_organizations, source_family, source_type, query_fingerprint,
    matched_segment_key, matched_archetype_key,
    extraction_method, completed_at
  ) values (
    target_workspace_id, target_campaign_id, target_provider_execution_id,
    target_provider_source_record_id, target_page->>'extractionVersion',
    case when (target_page->>'exhausted')::boolean then 'completed' else 'partial' end,
    (target_page->>'nextOffset')::integer,
    (target_page->>'totalOrganizations')::integer, 0, target_source_family,
    target_source_type, target_query_fingerprint, target_segment_key,
    target_archetype_key, 'deterministic_public_page',
    case when (target_page->>'exhausted')::boolean then now() else null end
  )
  on conflict (provider_source_record_id, extraction_version) do update set
    status = case
      when public.discovery_source_expansions_v2.status = 'completed' then 'completed'
      when excluded.status = 'completed' then 'completed'
      else 'partial' end,
    next_offset = case when excluded.status = 'completed' then null
      else greatest(public.discovery_source_expansions_v2.next_offset, excluded.next_offset) end,
    total_organizations = greatest(
      public.discovery_source_expansions_v2.total_organizations,
      excluded.total_organizations
    ),
    completed_at = case when excluded.status = 'completed' then now()
      else public.discovery_source_expansions_v2.completed_at end
  returning * into saved_expansion;

  for organization in select * from jsonb_array_elements(target_page->'organizations') loop
    insert into public.discovery_source_organization_references_v2 (
      workspace_id, campaign_id, source_expansion_id, provider_execution_id,
      provider_source_record_id, reference_key, organization_name, website_url,
      canonical_domain_hint, source_url, source_family, source_type,
      query_fingerprint, extraction_method, extraction_version, source_ordinal
    ) values (
      target_workspace_id, target_campaign_id, saved_expansion.id,
      target_provider_execution_id, target_provider_source_record_id,
      organization->>'referenceKey', organization->>'name',
      organization->>'websiteUrl', organization->>'canonicalDomainHint',
      organization->>'discoverySourceUrl', target_source_family, target_source_type,
      target_query_fingerprint, organization->>'extractionMethod',
      organization->>'extractionVersion', (organization->>'sourceOrdinal')::integer
    ) on conflict (provider_source_record_id, extraction_version, reference_key)
      do nothing;

    select * into saved_reference
    from public.discovery_source_organization_references_v2
    where provider_source_record_id = target_provider_source_record_id
      and extraction_version = organization->>'extractionVersion'
      and reference_key = organization->>'referenceKey';

    insert into public.normalized_provider_candidates (
      workspace_id, campaign_id, provider_source_record_id, provider_key, name,
      website_url, canonical_domain_hint, source_url, description,
      organization_type_hint, matched_segment_key, matched_archetype_key,
      matched_signals_json, preliminary_quality_json, normalization_version,
      candidate_reference_key, discovery_source_reference_id, created_at
    ) select
      target_workspace_id, target_campaign_id, target_provider_source_record_id,
      source_record.provider_key, organization->>'name', organization->>'websiteUrl',
      organization->>'canonicalDomainHint',
      coalesce(organization->>'websiteUrl', organization->>'discoverySourceUrl'),
      'Discovered through ' || organization->>'discoverySourceUrl', 'company',
      target_segment_key, target_archetype_key, '[]'::jsonb,
      jsonb_build_object(
        'likelyOperatingOrganization', null,
        'likelyTargetGeography', null,
        'hasUsableIdentity', true,
        'confidence', case when organization->>'websiteUrl' is null then 0.45 else 0.68 end
      ), target_normalization_version, organization->>'referenceKey',
      saved_reference.id, target_created_at
    from public.provider_source_records source_record
    where source_record.id = target_provider_source_record_id
    on conflict (provider_source_record_id, normalization_version, candidate_reference_key)
      do nothing;
  end loop;

  select count(*) into expanded_count
  from public.discovery_source_organization_references_v2
  where source_expansion_id = saved_expansion.id;
  update public.discovery_source_expansions_v2
  set expanded_organizations = expanded_count
  where id = saved_expansion.id;

  return jsonb_build_object(
    'expansionId', saved_expansion.id,
    'status', saved_expansion.status,
    'expandedOrganizations', expanded_count,
    'nextOffset', saved_expansion.next_offset
  );
end;
$$;

revoke all on function public.persist_discovery_source_expansion_v2(
  uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz
) from public, anon, authenticated;
grant execute on function public.persist_discovery_source_expansion_v2(
  uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz
) to service_role;

create or replace function public.load_discovery_source_expansion_v2(
  target_workspace_id uuid,
  target_source_expansion_id uuid
)
returns jsonb
language sql security definer stable set search_path = public as $$
  select case when auth.role() = 'service_role' then jsonb_build_object(
    'workspaceId', expansion.workspace_id,
    'campaignId', expansion.campaign_id,
    'providerExecutionId', expansion.provider_execution_id,
    'providerSourceRecordId', expansion.provider_source_record_id,
    'normalizationVersion', candidate.normalization_version,
    'segmentKey', expansion.matched_segment_key,
    'archetypeKey', expansion.matched_archetype_key,
    'sourceUrl', source_record.source_url,
    'content', source_record.raw_payload_json->>'content',
    'sourceFamily', expansion.source_family,
    'sourceType', expansion.source_type,
    'queryFingerprint', expansion.query_fingerprint,
    'nextOffset', expansion.next_offset,
    'status', expansion.status
  ) else null end
  from public.discovery_source_expansions_v2 expansion
  join public.provider_source_records source_record
    on source_record.id = expansion.provider_source_record_id
  left join lateral (
    select normalized.normalization_version
    from public.normalized_provider_candidates normalized
    where normalized.discovery_source_reference_id in (
      select reference.id
      from public.discovery_source_organization_references_v2 reference
      where reference.source_expansion_id = expansion.id
    )
    order by normalized.created_at
    limit 1
  ) candidate on true
  where expansion.id = target_source_expansion_id
    and expansion.workspace_id = target_workspace_id;
$$;

revoke all on function public.load_discovery_source_expansion_v2(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.load_discovery_source_expansion_v2(uuid,uuid)
  to service_role;

create or replace function public.load_campaign_entity_resolution_inputs_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare campaign_run public.campaign_runs;
declare discovery_run public.discovery_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into campaign_run from public.campaign_runs
  where id = target_campaign_run_id and workspace_id = target_workspace_id
    and workflow_version = 'v2';
  if campaign_run.id is null then raise exception 'V2 Campaign Run not found.'; end if;
  select * into discovery_run from public.discovery_runs_v2
  where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and status in ('completed', 'stopped_budget', 'stopped_user');
  if discovery_run.id is null then raise exception 'Completed Semantic Discovery Run not found.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'normalizedCandidateId', candidate.id,
      'providerSourceRecordId', candidate.provider_source_record_id,
      'name', candidate.name, 'normalizedName', candidate.normalized_name,
      'websiteUrl', candidate.website_url,
      'canonicalDomainHint', candidate.canonical_domain_hint,
      'sourceUrl', candidate.source_url, 'country', candidate.country,
      'organizationTypeHint', candidate.organization_type_hint,
      'matchedSegmentKey', candidate.matched_segment_key,
      'matchedArchetypeKey', candidate.matched_archetype_key,
      'preliminaryQuality', candidate.preliminary_quality_json,
      'sourcePageType', source_record.raw_payload_json->>'pageType',
      'discoverySource', case when source_reference.id is null then null else
        jsonb_build_object(
          'extractionMethod', source_reference.extraction_method,
          'sourceUrl', source_reference.source_url
        ) end
    ) order by candidate.id)
    from public.normalized_provider_candidates candidate
    join public.provider_source_records source_record
      on source_record.id = candidate.provider_source_record_id
    join public.discovery_provider_executions provider_execution
      on provider_execution.id = source_record.provider_execution_id
    join public.discovery_segment_runs_v2 segment_run
      on segment_run.id = provider_execution.discovery_segment_run_id
    left join public.discovery_source_organization_references_v2 source_reference
      on source_reference.id = candidate.discovery_source_reference_id
    where segment_run.discovery_run_id = discovery_run.id
      and candidate.workspace_id = target_workspace_id
      and candidate.campaign_id = campaign_run.campaign_id
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.load_campaign_entity_resolution_inputs_v2(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.load_campaign_entity_resolution_inputs_v2(uuid,uuid)
  to service_role;
