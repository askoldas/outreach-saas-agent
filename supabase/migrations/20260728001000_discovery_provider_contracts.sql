-- Discovery V2 provider contracts and immutable ingestion. Apply after 20260728000900.

create table public.discovery_provider_capability_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider_key text not null check (length(trim(provider_key)) > 0),
  adapter_version text not null check (length(trim(adapter_version)) > 0),
  capabilities_json jsonb not null check (jsonb_typeof(capabilities_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  captured_at timestamptz not null default now(),
  unique (workspace_id, provider_key, adapter_version, content_hash)
);

create table public.discovery_provider_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  discovery_plan_key text not null,
  discovery_segment_key text not null,
  provider_key text not null,
  adapter_version text not null,
  capability_snapshot_id uuid not null
    references public.discovery_provider_capability_snapshots(id) on delete cascade,
  external_execution_key text not null,
  request_hash text not null check (length(request_hash) = 64),
  request_json jsonb not null check (jsonb_typeof(request_json) = 'object'),
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  result_count integer not null default 0 check (result_count >= 0),
  next_cursor text,
  exhausted boolean,
  warnings_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(warnings_json) = 'array'),
  errors_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(errors_json) = 'array'),
  usage_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(usage_json) = 'object'),
  unique (
    workspace_id, campaign_id, discovery_segment_key,
    provider_key, adapter_version, request_hash
  ),
  unique (workspace_id, external_execution_key)
);

create table public.provider_source_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  discovery_plan_key text not null,
  discovery_segment_key text not null,
  provider_execution_id uuid not null
    references public.discovery_provider_executions(id) on delete cascade,
  source_record_key text not null,
  provider_key text not null,
  adapter_version text not null,
  provider_record_id text,
  source_type text not null check (source_type in (
    'web_search', 'company_database', 'registry', 'maps',
    'industry_directory', 'marketplace', 'funding', 'jobs', 'news'
  )),
  source_url text,
  result_rank integer check (result_rank > 0),
  query_or_filter_fingerprint text not null,
  raw_payload_json jsonb not null check (jsonb_typeof(raw_payload_json) = 'object'),
  raw_payload_hash text not null check (length(raw_payload_hash) = 64),
  retrieved_at timestamptz not null,
  provider_published_at timestamptz,
  provider_updated_at timestamptz,
  ingestion_status text not null default 'received'
    check (ingestion_status in (
      'received', 'normalized', 'suppressed', 'failed_normalization'
    )),
  duplicate_of_source_record_id uuid
    references public.provider_source_records(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (provider_execution_id, source_record_key)
);

create table public.normalized_provider_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider_source_record_id uuid not null
    references public.provider_source_records(id) on delete cascade,
  provider_key text not null,
  name text not null check (length(trim(name)) > 0),
  normalized_name text,
  website_url text,
  canonical_domain_hint text,
  source_url text,
  country text,
  region text,
  locality text,
  description text,
  industries_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(industries_json) = 'array'),
  keywords_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(keywords_json) = 'array'),
  employee_count integer check (employee_count >= 0),
  organization_type_hint text check (organization_type_hint in (
    'company', 'brand', 'branch', 'storefront', 'legal_entity',
    'directory_listing', 'marketplace_seller', 'unknown'
  )),
  matched_segment_key text not null,
  matched_archetype_key text not null,
  matched_signals_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matched_signals_json) = 'array'),
  preliminary_quality_json jsonb not null
    check (jsonb_typeof(preliminary_quality_json) = 'object'),
  normalization_version text not null,
  created_at timestamptz not null,
  unique (provider_source_record_id, normalization_version)
);

create index provider_source_records_lookup_idx
on public.provider_source_records(
  workspace_id, campaign_id, provider_key, discovery_segment_key, retrieved_at desc
);
create index normalized_provider_candidates_campaign_idx
on public.normalized_provider_candidates(workspace_id, campaign_id, created_at desc);

create or replace function public.validate_discovery_provider_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name = 'discovery_provider_executions' then
    select workspace_id into expected_workspace_id
    from public.campaigns where id = new.campaign_id;
    if not exists (
      select 1 from public.discovery_provider_capability_snapshots
      where id = new.capability_snapshot_id and workspace_id = new.workspace_id
        and provider_key = new.provider_key and adapter_version = new.adapter_version
    ) then raise exception 'Provider capability snapshot mismatch.'; end if;
  elsif tg_table_name = 'provider_source_records' then
    select workspace_id into expected_workspace_id
    from public.discovery_provider_executions
    where id = new.provider_execution_id and campaign_id = new.campaign_id
      and provider_key = new.provider_key and adapter_version = new.adapter_version;
  elsif tg_table_name = 'normalized_provider_candidates' then
    select workspace_id into expected_workspace_id
    from public.provider_source_records
    where id = new.provider_source_record_id and campaign_id = new.campaign_id
      and provider_key = new.provider_key;
  else
    return new;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Discovery provider association.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'discovery_provider_executions', 'provider_source_records',
    'normalized_provider_candidates'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_discovery_provider_workspace()',
      table_name || '_workspace_guard', table_name
    );
  end loop;
end;
$$;

create or replace function public.reject_discovery_provider_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Discovery provider source and normalized records are immutable after insertion.';
end;
$$;
create trigger provider_source_records_immutable
before update on public.provider_source_records
for each row execute function public.reject_discovery_provider_update();
create trigger normalized_provider_candidates_immutable
before update on public.normalized_provider_candidates
for each row execute function public.reject_discovery_provider_update();
create trigger discovery_provider_capability_snapshots_immutable
before update on public.discovery_provider_capability_snapshots
for each row execute function public.reject_discovery_provider_update();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'discovery_provider_capability_snapshots', 'discovery_provider_executions',
    'provider_source_records', 'normalized_provider_candidates'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_workspace_admin(workspace_id))',
      'Admins can insert ' || table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.persist_discovery_provider_response(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_plan_key text,
  target_segment_key text,
  target_provider_key text,
  target_adapter_version text,
  target_capabilities jsonb,
  target_capabilities_hash text,
  target_execution_key text,
  target_request_hash text,
  target_request jsonb,
  target_response jsonb,
  target_normalization_version text
)
returns public.discovery_provider_executions
language plpgsql security definer set search_path = public as $$
declare capability public.discovery_provider_capability_snapshots;
declare execution public.discovery_provider_executions;
declare source jsonb;
declare candidate jsonb;
declare saved_source public.provider_source_records;
declare duplicate_source_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.campaigns
    where id = target_campaign_id and workspace_id = target_workspace_id
  ) then raise exception 'Campaign not found.'; end if;
  insert into public.discovery_provider_capability_snapshots (
    workspace_id, provider_key, adapter_version, capabilities_json, content_hash
  ) values (
    target_workspace_id, target_provider_key, target_adapter_version,
    target_capabilities, target_capabilities_hash
  )
  on conflict (workspace_id, provider_key, adapter_version, content_hash)
  do nothing;
  select * into capability from public.discovery_provider_capability_snapshots
  where workspace_id = target_workspace_id and provider_key = target_provider_key
    and adapter_version = target_adapter_version and content_hash = target_capabilities_hash;
  insert into public.discovery_provider_executions (
    workspace_id, campaign_id, discovery_plan_key, discovery_segment_key,
    provider_key, adapter_version, capability_snapshot_id,
    external_execution_key, request_hash, request_json, status,
    completed_at, result_count, next_cursor, exhausted,
    warnings_json, errors_json, usage_json
  ) values (
    target_workspace_id, target_campaign_id, target_plan_key, target_segment_key,
    target_provider_key, target_adapter_version, capability.id,
    target_execution_key, target_request_hash, target_request, 'completed',
    now(), jsonb_array_length(target_response->'records'),
    target_response->>'nextCursor', (target_response->>'exhausted')::boolean,
    coalesce(target_response->'warnings', '[]'::jsonb),
    coalesce(target_response->'errors', '[]'::jsonb),
    coalesce(target_response->'usage', '{}'::jsonb)
  )
  on conflict (
    workspace_id, campaign_id, discovery_segment_key,
    provider_key, adapter_version, request_hash
  ) do update set request_hash = public.discovery_provider_executions.request_hash
  returning * into execution;
  for source in select * from jsonb_array_elements(target_response->'records') loop
    duplicate_source_id := null;
    select id into duplicate_source_id
    from public.provider_source_records
    where workspace_id = target_workspace_id and campaign_id = target_campaign_id
      and provider_key = target_provider_key
      and (
        (
          source->>'providerRecordId' is not null
          and provider_record_id = source->>'providerRecordId'
        )
        or (
          source->>'sourceUrl' is not null
          and source_url = source->>'sourceUrl'
        )
        or raw_payload_hash = source->>'rawPayloadHash'
      )
    order by created_at, id
    limit 1;
    insert into public.provider_source_records (
      workspace_id, campaign_id, discovery_plan_key, discovery_segment_key,
      provider_execution_id, source_record_key, provider_key, adapter_version,
      provider_record_id, source_type, source_url, result_rank,
      query_or_filter_fingerprint, raw_payload_json, raw_payload_hash,
      retrieved_at, provider_published_at, provider_updated_at, ingestion_status,
      duplicate_of_source_record_id
    ) values (
      target_workspace_id, target_campaign_id, target_plan_key, target_segment_key,
      execution.id, source->>'sourceRecordKey', target_provider_key, target_adapter_version,
      source->>'providerRecordId', source->>'sourceType', source->>'sourceUrl',
      (source->>'resultRank')::integer, source->>'queryOrFilterFingerprint',
      source->'rawPayload', source->>'rawPayloadHash',
      (source->>'retrievedAt')::timestamptz,
      (source->>'providerPublishedAt')::timestamptz,
      (source->>'providerUpdatedAt')::timestamptz,
      case when duplicate_source_id is not null then 'suppressed'
      when exists (
        select 1 from jsonb_array_elements(target_response->'normalizedCandidates') c
        where c->>'sourceRecordKey' = source->>'sourceRecordKey'
      ) then 'normalized' else 'received' end,
      duplicate_source_id
    )
    on conflict (provider_execution_id, source_record_key) do nothing;
  end loop;
  for candidate in select * from jsonb_array_elements(target_response->'normalizedCandidates') loop
    select * into saved_source from public.provider_source_records
    where provider_execution_id = execution.id
      and source_record_key = candidate->>'sourceRecordKey';
    if saved_source.id is null then
      raise exception 'Normalized candidate references an unknown source record.';
    end if;
    if saved_source.ingestion_status <> 'suppressed' then
      insert into public.normalized_provider_candidates (
      workspace_id, campaign_id, provider_source_record_id, provider_key,
      name, normalized_name, website_url, canonical_domain_hint, source_url,
      country, region, locality, description, industries_json, keywords_json,
      employee_count, organization_type_hint, matched_segment_key,
      matched_archetype_key, matched_signals_json, preliminary_quality_json,
      normalization_version, created_at
    ) values (
      target_workspace_id, target_campaign_id, saved_source.id, target_provider_key,
      candidate->>'name', candidate->>'normalizedName',
      candidate->>'websiteUrl', candidate->>'canonicalDomainHint',
      candidate->>'sourceUrl', candidate->>'country', candidate->>'region',
      candidate->>'locality', candidate->>'description',
      coalesce(candidate->'industries', '[]'::jsonb),
      coalesce(candidate->'keywords', '[]'::jsonb),
      (candidate->>'employeeCount')::integer, candidate->>'organizationTypeHint',
      candidate->>'matchedSegmentId', candidate->>'matchedArchetypeId',
      coalesce(candidate->'matchedSignals', '[]'::jsonb),
      candidate->'preliminaryQuality', target_normalization_version,
      (candidate->>'createdAt')::timestamptz
      ) on conflict (provider_source_record_id, normalization_version) do nothing;
    end if;
  end loop;
  return execution;
end;
$$;

revoke all on function public.persist_discovery_provider_response(
  uuid,uuid,text,text,text,text,jsonb,text,text,text,jsonb,jsonb,text
) from public, anon;
grant execute on function public.persist_discovery_provider_response(
  uuid,uuid,text,text,text,text,jsonb,text,text,text,jsonb,jsonb,text
) to authenticated, service_role;
