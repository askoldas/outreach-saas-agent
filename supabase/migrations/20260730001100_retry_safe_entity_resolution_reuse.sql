-- A partially completed Campaign Run can leave canonical organizations with
-- active source lineage before a later stage fails. Subsequent runs may find
-- the same organizations through new provider records, but the V2.2 resolver
-- treated every exact name-country reuse as a weak match and deferred it.
--
-- Promote only one unambiguous, type-compatible organization with prior active
-- lineage to an active source link. The existing resolver then processes that
-- link through its deterministic path and records the normal decision,
-- campaign projection, and audit trail. Ambiguous matches remain untouched.

alter function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
)
rename to resolve_campaign_entities_before_retry_safe_reuse_v2;

revoke all on function
  public.resolve_campaign_entities_before_retry_safe_reuse_v2(
    uuid, uuid, text, text, jsonb
  )
from public, anon, authenticated, service_role;

create function public.resolve_campaign_entities_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_rules_version text,
  target_input_hash text,
  target_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prepared jsonb;
  candidate_id uuid;
  candidate_source_id uuid;
  candidate_normalized_name text;
  candidate_country text;
  candidate_domain text;
  candidate_type text;
  compatible_match_ids uuid[];
  matched_organization_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if jsonb_typeof(target_candidates) <> 'array' then
    raise exception 'Invalid Entity Resolution batch input.';
  end if;

  -- Completed batches are immutable and replay through the original resolver.
  if exists (
    select 1
    from public.entity_resolution_batches_v2 batch
    where batch.workspace_id = target_workspace_id
      and batch.campaign_run_id = target_campaign_run_id
      and batch.rules_version = target_rules_version
  ) then
    return public.resolve_campaign_entities_before_retry_safe_reuse_v2(
      target_workspace_id,
      target_campaign_run_id,
      target_rules_version,
      target_input_hash,
      target_candidates
    );
  end if;

  for prepared in
    select item.value
    from jsonb_array_elements(target_candidates) item(value)
    order by item.value->>'normalizedCandidateId'
  loop
    if coalesce((prepared->>'invalidIdentity')::boolean, false) then
      continue;
    end if;

    candidate_id := (prepared->>'normalizedCandidateId')::uuid;
    candidate_source_id := (prepared->>'providerSourceRecordId')::uuid;
    candidate_normalized_name := trim(prepared->>'normalizedName');
    candidate_country := nullif(upper(trim(prepared->>'country')), '');
    candidate_domain := nullif(lower(trim(prepared->>'canonicalDomain')), '');
    candidate_type := coalesce(
      nullif(prepared->>'organizationType', ''),
      'unknown'
    );

    if candidate_normalized_name = '' or candidate_country is null then
      continue;
    end if;

    if not exists (
      select 1
      from public.normalized_provider_candidates candidate
      join public.provider_source_records source_record
        on source_record.id = candidate.provider_source_record_id
      where candidate.id = candidate_id
        and candidate.provider_source_record_id = candidate_source_id
        and candidate.workspace_id = target_workspace_id
        and source_record.workspace_id = target_workspace_id
    ) then
      continue;
    end if;

    select coalesce(
      array_agg(distinct company.id order by company.id),
      '{}'::uuid[]
    )
    into compatible_match_ids
    from public.companies company
    where company.workspace_id = target_workspace_id
      and company.merged_into_company_id is null
      and company.normalized_name = candidate_normalized_name
      and upper(coalesce(company.country, '')) = candidate_country
      and (
        candidate_type = 'unknown'
        or company.organization_type = 'unknown'
        or company.organization_type = candidate_type
      )
      and exists (
        select 1
        from public.organization_source_links historical_link
        where historical_link.workspace_id = target_workspace_id
          and historical_link.organization_id = company.id
          and historical_link.link_status = 'active'
      )
      and not exists (
        select 1
        from public.organization_source_links conflicting_active_link
        where conflicting_active_link.workspace_id = target_workspace_id
          and conflicting_active_link.provider_source_record_id =
            candidate_source_id
          and conflicting_active_link.link_status = 'active'
          and conflicting_active_link.organization_id <> company.id
      )
      and (
        candidate_domain is null
        or not exists (
          select 1
          from public.company_domains conflicting_domain
          where conflicting_domain.workspace_id = target_workspace_id
            and conflicting_domain.company_id = company.id
            and conflicting_domain.domain_role <> 'shared_directory'
            and conflicting_domain.verification_status in (
              'source_confirmed',
              'verified'
            )
            and conflicting_domain.normalized_domain <> candidate_domain
        )
      );

    if cardinality(compatible_match_ids) <> 1 then
      continue;
    end if;

    matched_organization_id := compatible_match_ids[1];

    insert into public.organization_source_links (
      workspace_id,
      organization_id,
      provider_source_record_id,
      normalized_candidate_id,
      resolution_decision_id,
      link_status,
      confidence
    ) values (
      target_workspace_id,
      matched_organization_id,
      candidate_source_id,
      candidate_id,
      null,
      'active',
      0.9
    )
    on conflict (provider_source_record_id, organization_id)
    do update set
      normalized_candidate_id = excluded.normalized_candidate_id,
      link_status = 'active',
      confidence = greatest(
        public.organization_source_links.confidence,
        excluded.confidence
      );
  end loop;

  return public.resolve_campaign_entities_before_retry_safe_reuse_v2(
    target_workspace_id,
    target_campaign_run_id,
    target_rules_version,
    target_input_hash,
    target_candidates
  );
end;
$$;

revoke all on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
)
from public, anon, authenticated;

grant execute on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
)
to service_role;
