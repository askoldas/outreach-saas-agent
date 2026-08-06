-- A public source may be encountered by more than one Campaign Run. Preserve
-- the cross-run duplicate link, but normalize the source again for the current
-- provider execution so the new run owns a complete, frozen candidate set.

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
language plpgsql
security definer
set search_path = public
as $$
declare
  capability public.discovery_provider_capability_snapshots;
  execution public.discovery_provider_executions;
  source jsonb;
  candidate jsonb;
  saved_source public.provider_source_records;
  duplicate_source_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  if not exists (
    select 1
    from public.campaigns
    where id = target_campaign_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'Campaign not found.';
  end if;

  insert into public.discovery_provider_capability_snapshots (
    workspace_id,
    provider_key,
    adapter_version,
    capabilities_json,
    content_hash
  ) values (
    target_workspace_id,
    target_provider_key,
    target_adapter_version,
    target_capabilities,
    target_capabilities_hash
  )
  on conflict (workspace_id, provider_key, adapter_version, content_hash)
  do nothing;

  select *
  into capability
  from public.discovery_provider_capability_snapshots
  where workspace_id = target_workspace_id
    and provider_key = target_provider_key
    and adapter_version = target_adapter_version
    and content_hash = target_capabilities_hash;

  insert into public.discovery_provider_executions (
    workspace_id,
    campaign_id,
    discovery_plan_key,
    discovery_segment_key,
    provider_key,
    adapter_version,
    capability_snapshot_id,
    external_execution_key,
    request_hash,
    request_json,
    status,
    completed_at,
    result_count,
    next_cursor,
    exhausted,
    warnings_json,
    errors_json,
    usage_json
  ) values (
    target_workspace_id,
    target_campaign_id,
    target_plan_key,
    target_segment_key,
    target_provider_key,
    target_adapter_version,
    capability.id,
    target_execution_key,
    target_request_hash,
    target_request,
    'completed',
    now(),
    jsonb_array_length(target_response->'records'),
    target_response->>'nextCursor',
    (target_response->>'exhausted')::boolean,
    coalesce(target_response->'warnings', '[]'::jsonb),
    coalesce(target_response->'errors', '[]'::jsonb),
    coalesce(target_response->'usage', '{}'::jsonb)
  )
  on conflict (
    workspace_id,
    campaign_id,
    discovery_segment_key,
    provider_key,
    adapter_version,
    request_hash
  ) do update
  set request_hash = public.discovery_provider_executions.request_hash
  returning * into execution;

  for source in
    select *
    from jsonb_array_elements(target_response->'records')
  loop
    duplicate_source_id := null;

    select id
    into duplicate_source_id
    from public.provider_source_records
    where workspace_id = target_workspace_id
      and campaign_id = target_campaign_id
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
      workspace_id,
      campaign_id,
      discovery_plan_key,
      discovery_segment_key,
      provider_execution_id,
      source_record_key,
      provider_key,
      adapter_version,
      provider_record_id,
      source_type,
      source_url,
      result_rank,
      query_or_filter_fingerprint,
      raw_payload_json,
      raw_payload_hash,
      retrieved_at,
      provider_published_at,
      provider_updated_at,
      ingestion_status,
      duplicate_of_source_record_id
    ) values (
      target_workspace_id,
      target_campaign_id,
      target_plan_key,
      target_segment_key,
      execution.id,
      source->>'sourceRecordKey',
      target_provider_key,
      target_adapter_version,
      source->>'providerRecordId',
      source->>'sourceType',
      source->>'sourceUrl',
      (source->>'resultRank')::integer,
      source->>'queryOrFilterFingerprint',
      source->'rawPayload',
      source->>'rawPayloadHash',
      (source->>'retrievedAt')::timestamptz,
      (source->>'providerPublishedAt')::timestamptz,
      (source->>'providerUpdatedAt')::timestamptz,
      case
        when exists (
          select 1
          from jsonb_array_elements(target_response->'normalizedCandidates') c
          where c->>'sourceRecordKey' = source->>'sourceRecordKey'
        ) then 'normalized'
        when duplicate_source_id is not null then 'suppressed'
        else 'received'
      end,
      duplicate_source_id
    )
    on conflict (provider_execution_id, source_record_key)
    do nothing;
  end loop;

  for candidate in
    select *
    from jsonb_array_elements(target_response->'normalizedCandidates')
  loop
    select *
    into saved_source
    from public.provider_source_records
    where provider_execution_id = execution.id
      and source_record_key = candidate->>'sourceRecordKey';

    if saved_source.id is null then
      raise exception 'Normalized candidate references an unknown source record.';
    end if;

    insert into public.normalized_provider_candidates (
      workspace_id,
      campaign_id,
      provider_source_record_id,
      provider_key,
      name,
      normalized_name,
      website_url,
      canonical_domain_hint,
      source_url,
      country,
      region,
      locality,
      description,
      industries_json,
      keywords_json,
      employee_count,
      organization_type_hint,
      matched_segment_key,
      matched_archetype_key,
      matched_signals_json,
      preliminary_quality_json,
      normalization_version,
      created_at
    ) values (
      target_workspace_id,
      target_campaign_id,
      saved_source.id,
      target_provider_key,
      candidate->>'name',
      candidate->>'normalizedName',
      candidate->>'websiteUrl',
      candidate->>'canonicalDomainHint',
      candidate->>'sourceUrl',
      candidate->>'country',
      candidate->>'region',
      candidate->>'locality',
      candidate->>'description',
      coalesce(candidate->'industries', '[]'::jsonb),
      coalesce(candidate->'keywords', '[]'::jsonb),
      (candidate->>'employeeCount')::integer,
      candidate->>'organizationTypeHint',
      candidate->>'matchedSegmentId',
      candidate->>'matchedArchetypeId',
      coalesce(candidate->'matchedSignals', '[]'::jsonb),
      candidate->'preliminaryQuality',
      target_normalization_version,
      (candidate->>'createdAt')::timestamptz
    )
    on conflict (provider_source_record_id, normalization_version)
    do nothing;
  end loop;

  return execution;
end;
$$;

revoke all on function public.persist_discovery_provider_response(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text
) from public, anon, authenticated;

grant execute on function public.persist_discovery_provider_response(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text
) to service_role;
