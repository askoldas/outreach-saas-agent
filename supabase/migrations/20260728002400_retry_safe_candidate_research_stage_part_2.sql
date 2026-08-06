-- Candidate Research V2 runtime, part 2 of 2.
-- Apply after 20260728002300_retry_safe_candidate_research_stage.sql.

create or replace function public.persist_candidate_research_source_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_source_kind text,
  target_provider_source_record_id uuid,
  target_source_url text,
  target_page_kind text,
  target_content text,
  target_content_hash text,
  target_retrieved_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_research_batch_members_v2;
  research_plan public.candidate_research_plans;
  source_record public.provider_source_records;
  page_fetch public.candidate_page_fetches;
  artifact public.candidate_research_source_artifacts_v2;
  evidence public.evidence_items;
  evidence_hash text;
  canonical_domain text;
  source_host text;
  task_type text;
  expected_discovery_page_kind text;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if target_source_kind not in ('discovery', 'first_party_fetch')
    or target_page_kind not in (
      'home', 'about', 'products_services', 'brands_partners', 'locations',
      'legal', 'supplier_procurement', 'careers', 'investor_relations',
      'news', 'contact', 'wholesale_b2b', 'other'
    )
    or length(target_content_hash) <> 64
    or encode(digest(target_content, 'sha256'), 'hex') <> target_content_hash
    or length(target_content) not between 1 and 100000
    or nullif(trim(target_source_url), '') is null
  then
    raise exception 'Invalid Candidate Research source payload.';
  end if;
  select *
  into member
  from public.candidate_research_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null or member.status not in ('running', 'completed', 'blocked') then
    raise exception 'Candidate Research member is not source-ready.';
  end if;
  select *
  into research_plan
  from public.candidate_research_plans
  where id = member.research_plan_id
    and workspace_id = target_workspace_id;
  if research_plan.id is null then
    raise exception 'Candidate Research plan not found.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'candidate-research-source:' ||
    target_workspace_id::text || '|' ||
    target_source_kind || '|' ||
    coalesce(target_provider_source_record_id::text, target_source_url) || '|' ||
    date_trunc('day', target_retrieved_at)::text,
    0
  ));

  if target_source_kind = 'discovery' then
    if target_provider_source_record_id is null
      or target_provider_source_record_id::text not in (
        select value
        from jsonb_array_elements_text(
          research_plan.source_plan_json->'discoverySourceIds'
        ) source_id(value)
      )
    then
      raise exception 'Discovery source is not frozen in the Research Plan.';
    end if;
    select *
    into source_record
    from public.provider_source_records
    where id = target_provider_source_record_id
      and workspace_id = target_workspace_id
      and source_url = target_source_url;
    if source_record.id is null or not exists (
      select 1
      from public.campaign_candidate_discovery_links discovery_link
      where discovery_link.workspace_id = target_workspace_id
        and discovery_link.campaign_candidate_id =
          member.campaign_candidate_id
        and discovery_link.provider_source_record_id = source_record.id
    ) then
      raise exception 'Discovery source does not belong to the Campaign Candidate.';
    end if;
    expected_discovery_page_kind := 'other';
    if source_record.raw_payload_json->>'pageType' = 'company_homepage' then
      expected_discovery_page_kind := 'home';
    elsif source_record.raw_payload_json->>'pageType' = 'company_subpage' then
      expected_discovery_page_kind := 'about';
    end if;
    if target_retrieved_at is distinct from source_record.retrieved_at
      or target_content <> left(
        coalesce(source_record.raw_payload_json->>'content', ''),
        100000
      )
      or target_page_kind <> expected_discovery_page_kind
    then
      raise exception 'Discovery source payload does not match frozen raw evidence.';
    end if;
    select *
    into artifact
    from public.candidate_research_source_artifacts_v2 existing
    where existing.organization_id = member.organization_id
      and existing.provider_source_record_id = source_record.id;
    if artifact.id is null then
      insert into public.candidate_research_source_artifacts_v2 (
        workspace_id,
        organization_id,
        provider_source_record_id,
        source_url,
        page_kind,
        content_text,
        content_hash,
        retrieved_at
      ) values (
        target_workspace_id,
        member.organization_id,
        source_record.id,
        target_source_url,
        target_page_kind,
        target_content,
        target_content_hash,
        target_retrieved_at
      )
      returning * into artifact;
    elsif artifact.content_hash <> target_content_hash then
      raise exception 'Frozen Discovery source content changed.';
    end if;
    task_type := 'reuse_evidence';
  else
    if target_provider_source_record_id is not null then
      raise exception 'First-party fetch cannot reference a Discovery source.';
    end if;
    canonical_domain := lower(
      trim(both '.' from
        coalesce(research_plan.source_plan_json->>'canonicalDomain', '')
      )
    );
    source_host := lower(
      split_part(
        split_part(
          regexp_replace(target_source_url, '^https?://', '', 'i'),
          '/',
          1
        ),
        ':',
        1
      )
    );
    source_host := regexp_replace(source_host, '^www\.', '');
    if canonical_domain = ''
      or (
        source_host <> canonical_domain
        and right(source_host, length(canonical_domain) + 1) <>
          '.' || canonical_domain
      )
    then
      raise exception 'First-party source is outside the canonical domain.';
    end if;
    select *
    into page_fetch
    from public.candidate_page_fetches existing
    where existing.workspace_id = target_workspace_id
      and existing.canonical_url = target_source_url
      and existing.freshness_window_started_at =
        date_trunc('day', target_retrieved_at);
    if page_fetch.id is null then
      insert into public.candidate_page_fetches (
        workspace_id,
        organization_id,
        canonical_url,
        page_kind,
        freshness_window_started_at,
        access_status,
        http_status,
        content_hash,
        retrieved_at,
        expires_at,
        raw_artifact_reference
      ) values (
        target_workspace_id,
        member.organization_id,
        target_source_url,
        target_page_kind,
        date_trunc('day', target_retrieved_at),
        'available',
        200,
        target_content_hash,
        target_retrieved_at,
        target_retrieved_at + interval '45 days',
        'candidate-research-v2:' || target_content_hash
      )
      returning * into page_fetch;
    elsif page_fetch.organization_id <> member.organization_id
      or page_fetch.content_hash is distinct from target_content_hash
    then
      raise exception 'Cached first-party page fetch changed identity or content.';
    end if;
    select *
    into artifact
    from public.candidate_research_source_artifacts_v2 existing
    where existing.organization_id = member.organization_id
      and existing.candidate_page_fetch_id = page_fetch.id;
    if artifact.id is null then
      insert into public.candidate_research_source_artifacts_v2 (
        workspace_id,
        organization_id,
        candidate_page_fetch_id,
        source_url,
        page_kind,
        content_text,
        content_hash,
        retrieved_at
      ) values (
        target_workspace_id,
        member.organization_id,
        page_fetch.id,
        target_source_url,
        target_page_kind,
        target_content,
        target_content_hash,
        target_retrieved_at
      )
      returning * into artifact;
    end if;
    task_type := 'fetch_first_party_page';
  end if;

  evidence_hash := encode(digest(
    'candidate-research-v2|' ||
    member.organization_id::text || '|' ||
    artifact.id::text || '|' ||
    target_source_url || '|' ||
    target_content_hash,
    'sha256'
  ), 'hex');
  select *
  into evidence
  from public.evidence_items existing
  where existing.workspace_id = target_workspace_id
    and existing.subject_type = 'organization'
    and existing.subject_id = member.organization_id
    and existing.content_hash = evidence_hash;
  if evidence.id is null then
    insert into public.evidence_items (
      workspace_id,
      subject_type,
      subject_id,
      discovery_provider_execution_id,
      candidate_page_fetch_id,
      evidence_type,
      structured_value_json,
      excerpt,
      location_json,
      directness,
      source_reliability,
      freshness_state,
      observed_at,
      retrieved_at,
      content_hash,
      visibility
    ) values (
      target_workspace_id,
      'organization',
      member.organization_id,
      case
        when source_record.id is not null
          then source_record.provider_execution_id
        else null
      end,
      page_fetch.id,
      case
        when page_fetch.id is not null then 'official_web_page'
        when source_record.source_type = 'registry' then 'legal_registry'
        when source_record.source_type = 'company_database'
          then 'company_database'
        when source_record.source_type = 'industry_directory'
          then 'directory_profile'
        else 'official_web_page'
      end,
      jsonb_build_object(
        'artifactId', artifact.id,
        'pageKind', target_page_kind,
        'sourceUrl', target_source_url
      ),
      left(target_content, 800),
      jsonb_build_object(
        'url', target_source_url,
        'artifactId', artifact.id
      ),
      'direct',
      case
        when page_fetch.id is not null then 'first_party'
        when source_record.source_type = 'registry'
          then 'authoritative_registry'
        when source_record.source_type = 'industry_directory'
          then 'trusted_directory'
        else 'unverified_secondary'
      end,
      'current',
      target_retrieved_at,
      target_retrieved_at,
      evidence_hash,
      'public'
    )
    returning * into evidence;
  end if;

  insert into public.candidate_research_member_sources_v2 (
    workspace_id,
    candidate_research_member_id,
    source_artifact_id,
    evidence_id
  ) values (
    target_workspace_id,
    member.id,
    artifact.id,
    evidence.id
  )
  on conflict (candidate_research_member_id, source_artifact_id) do nothing;

  insert into public.candidate_research_tasks (
    workspace_id,
    research_plan_id,
    question_key,
    task_type,
    source_url,
    evidence_id,
    status,
    priority,
    idempotency_key,
    result_reference_json,
    started_at,
    completed_at
  ) values (
    target_workspace_id,
    member.research_plan_id,
    '__source__',
    task_type,
    target_source_url,
    evidence.id,
    case
      when task_type = 'reuse_evidence' then 'skipped_reused'
      else 'completed'
    end,
    100,
    'source:' || artifact.id::text,
    jsonb_build_object(
      'artifactId', artifact.id,
      'evidenceId', evidence.id,
      'contentHash', artifact.content_hash
    ),
    now(),
    now()
  )
  on conflict (research_plan_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'artifactId', artifact.id,
    'evidenceId', evidence.id,
    'sourceKind', target_source_kind,
    'sourceUrl', artifact.source_url,
    'pageKind', artifact.page_kind,
    'retrievedAt', artifact.retrieved_at,
    'contentHash', artifact.content_hash,
    'content', artifact.content_text
  );
end;
$$;

create or replace function public.save_candidate_research_extraction_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_request_hash text,
  target_output jsonb,
  target_ai_request jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_research_batch_members_v2;
  research_batch public.candidate_research_batches_v2;
  existing_task public.candidate_research_tasks;
  saved_ai_request public.ai_requests;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if length(target_request_hash) <> 64
    or jsonb_typeof(target_output) <> 'object'
    or jsonb_typeof(target_ai_request) <> 'object'
  then
    raise exception 'Invalid Candidate Research extraction payload.';
  end if;
  select *
  into member
  from public.candidate_research_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null or member.status <> 'running' then
    raise exception 'Candidate Research member is not running.';
  end if;
  select *
  into research_batch
  from public.candidate_research_batches_v2
  where id = member.candidate_research_batch_id
    and workspace_id = target_workspace_id;
  select *
  into existing_task
  from public.candidate_research_tasks
  where research_plan_id = member.research_plan_id
    and idempotency_key = 'extract:' || target_request_hash;
  if existing_task.id is not null then
    if existing_task.status <> 'completed' then
      raise exception 'Candidate Research extraction is not settled.';
    end if;
    return existing_task.result_reference_json;
  end if;

  insert into public.ai_requests (
    workspace_id,
    campaign_run_id,
    role,
    provider,
    selected_model,
    fallback_model,
    fallback_used,
    prompt_version,
    schema_version,
    request_hash,
    status,
    input_units,
    output_units,
    actual_cost,
    currency,
    metadata,
    started_at,
    completed_at
  ) values (
    target_workspace_id,
    research_batch.campaign_run_id,
    'candidate.evidence_extraction',
    coalesce(target_ai_request->>'provider', 'openrouter'),
    coalesce(
      target_ai_request->>'actualModel',
      target_ai_request->>'requestedModel'
    ),
    case
      when coalesce(
        (target_ai_request->>'fallbackUsed')::boolean,
        false
      ) then target_ai_request->>'actualModel'
      else null
    end,
    coalesce(
      (target_ai_request->>'fallbackUsed')::boolean,
      false
    ),
    'candidate-evidence-extraction-v2.1',
    'candidate-evidence-extraction-v2.1',
    target_request_hash,
    'completed',
    nullif(target_ai_request->>'inputTokens', '')::bigint,
    nullif(target_ai_request->>'outputTokens', '')::bigint,
    coalesce(
      nullif(target_ai_request->>'actualCost', '')::numeric,
      0
    ),
    coalesce(target_ai_request->>'currency', 'USD'),
    jsonb_build_object(
      'candidateResearchMemberId', member.id,
      'campaignCandidateId', member.campaign_candidate_id,
      'organizationId', member.organization_id,
      'providerRequestId', target_ai_request->>'providerRequestId',
      'latencyMs', nullif(target_ai_request->>'latencyMs', '')::integer,
      'fallbackReason', target_ai_request->>'fallbackReason',
      'responseHash', encode(digest(target_output::text, 'sha256'), 'hex')
    ),
    coalesce(
      nullif(target_ai_request->>'startedAt', '')::timestamptz,
      now()
    ),
    now()
  )
  returning * into saved_ai_request;

  insert into public.candidate_research_tasks (
    workspace_id,
    research_plan_id,
    question_key,
    task_type,
    status,
    priority,
    idempotency_key,
    result_reference_json,
    started_at,
    completed_at
  ) values (
    target_workspace_id,
    member.research_plan_id,
    '__extraction__',
    'extract_claims',
    'completed',
    100,
    'extract:' || target_request_hash,
    jsonb_build_object(
      'output', target_output,
      'aiRequestId', saved_ai_request.id
    ),
    saved_ai_request.started_at,
    saved_ai_request.completed_at
  );

  return jsonb_build_object(
    'output', target_output,
    'aiRequestId', saved_ai_request.id
  );
end;
$$;

create or replace function public.complete_candidate_research_member_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_extraction_request_hash text,
  target_claims jsonb,
  target_question_findings jsonb,
  target_missing_evidence jsonb,
  target_evidence_ids jsonb,
  target_ai_request_ids jsonb,
  target_access_blocked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_research_batch_members_v2;
  research_plan public.candidate_research_plans;
  prior_intelligence public.candidate_intelligence_versions;
  claim_item jsonb;
  prior_claim_id_value text;
  evidence_id_value text;
  finding_item jsonb;
  saved_claim_id uuid;
  claim_status text;
  claim_is_conflicting boolean;
  claim_ids uuid[] := '{}';
  evidence_ids uuid[] := '{}';
  new_claim_ids uuid[] := '{}';
  source_evidence_ids uuid[] := '{}';
  unresolved_keys text[] := '{}';
  conflict_keys text[] := '{}';
  next_version integer;
  source_cutoff timestamptz;
  snapshot jsonb;
  content_hash text;
  intelligence_version public.candidate_intelligence_versions;
  output_reference jsonb;
  ai_origin_id uuid;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if length(target_extraction_request_hash) <> 64
    or jsonb_typeof(target_claims) <> 'array'
    or jsonb_typeof(target_question_findings) <> 'array'
    or jsonb_typeof(target_missing_evidence) <> 'array'
    or jsonb_typeof(target_evidence_ids) <> 'array'
    or jsonb_typeof(target_ai_request_ids) <> 'array'
  then
    raise exception 'Invalid Candidate Research completion payload.';
  end if;
  select *
  into member
  from public.candidate_research_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null then
    raise exception 'Candidate Research member not found.';
  end if;
  if member.status in ('completed', 'blocked') then
    return member.output_reference_json;
  end if;
  if member.status <> 'running' then
    raise exception 'Candidate Research member is not running.';
  end if;
  select *
  into research_plan
  from public.candidate_research_plans
  where id = member.research_plan_id
    and workspace_id = target_workspace_id;
  if research_plan.id is null then
    raise exception 'Candidate Research plan not found.';
  end if;
  for prior_claim_id_value in
    select value
    from jsonb_array_elements_text(
      coalesce(
        research_plan.source_plan_json->'deferredReusableQuestionKeys',
        '[]'::jsonb
      )
    )
  loop
    if prior_claim_id_value <> all(unresolved_keys) then
      unresolved_keys := array_append(unresolved_keys, prior_claim_id_value);
    end if;
  end loop;
  select intelligence_version.*
  into prior_intelligence
  from public.candidate_intelligence_versions intelligence_version
  where intelligence_version.workspace_id = target_workspace_id
    and intelligence_version.organization_id = member.organization_id
  order by
    case
      when intelligence_version.id = (
        select campaign_candidate.current_intelligence_version_id
        from public.campaign_candidates campaign_candidate
        where campaign_candidate.id = member.campaign_candidate_id
          and campaign_candidate.workspace_id = target_workspace_id
      ) then 0
      else 1
    end,
    intelligence_version.version_number desc
  limit 1;
  if (
    select count(distinct finding->>'questionKey')
    from jsonb_array_elements(target_question_findings) finding
  ) <> jsonb_array_length(research_plan.questions_json)
    or exists (
      select 1
      from jsonb_array_elements(research_plan.questions_json) question
      where not exists (
        select 1
        from jsonb_array_elements(target_question_findings) finding
        where finding->>'questionKey' = question->>'key'
      )
    )
  then
    raise exception 'Candidate Research findings do not cover the frozen questions.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(target_evidence_ids) item(value)
    where not exists (
      select 1
      from public.candidate_research_member_sources_v2 member_source
      where member_source.candidate_research_member_id = member.id
        and member_source.evidence_id = item.value::uuid
    )
  ) then
    raise exception 'Candidate Research completion contains foreign evidence.';
  end if;
  if not target_access_blocked and jsonb_array_length(target_ai_request_ids) <> 1 then
    raise exception 'Candidate Research extraction requires one audited AI request.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(target_ai_request_ids) item(value)
    where not exists (
      select 1
      from public.ai_requests ai_request
      where ai_request.id = item.value::uuid
        and ai_request.workspace_id = target_workspace_id
        and ai_request.request_hash = target_extraction_request_hash
        and ai_request.status = 'completed'
    )
  ) then
    raise exception 'Candidate Research completion contains foreign AI requests.';
  end if;
  ai_origin_id := nullif(target_ai_request_ids->>0, '')::uuid;

  for evidence_id_value in
    select value
    from jsonb_array_elements_text(target_evidence_ids)
  loop
    source_evidence_ids := array_append(
      source_evidence_ids,
      evidence_id_value::uuid
    );
  end loop;
  if prior_intelligence.id is not null then
    for prior_claim_id_value in
      select value
      from jsonb_array_elements_text(prior_intelligence.claim_ids_json)
    loop
      if exists (
        select 1
        from public.intelligence_claims prior_claim
        where prior_claim.id = prior_claim_id_value::uuid
          and exists (
            select 1
            from public.candidate_claims prior_candidate_claim
            where prior_candidate_claim.intelligence_claim_id = prior_claim.id
              and prior_candidate_claim.workspace_id = target_workspace_id
              and prior_candidate_claim.organization_id =
                member.organization_id
          )
          and not exists (
            select 1
            from jsonb_array_elements(target_claims) new_claim
            where new_claim->>'key' = prior_claim.claim_key
              and new_claim->>'status' <> 'unknown'
              and exists (
                select 1
                from jsonb_array_elements(target_question_findings) finding
                where finding->>'questionKey' = prior_claim.claim_key
                  and finding->>'state' in (
                    'answered_positive', 'answered_negative'
                  )
              )
          )
      ) then
        claim_ids := array_append(
          claim_ids,
          prior_claim_id_value::uuid
        );
        for evidence_id_value in
          select claim_evidence.evidence_id::text
          from public.claim_evidence_links claim_evidence
          where claim_evidence.claim_id = prior_claim_id_value::uuid
            and claim_evidence.workspace_id = target_workspace_id
        loop
          if evidence_id_value::uuid <> all(evidence_ids) then
            evidence_ids := array_append(
              evidence_ids,
              evidence_id_value::uuid
            );
          end if;
        end loop;
      end if;
    end loop;
    for prior_claim_id_value in
      select value
      from jsonb_array_elements_text(
        prior_intelligence.unresolved_question_keys_json
      )
    loop
      if prior_claim_id_value <> all(unresolved_keys) then
        unresolved_keys := array_append(
          unresolved_keys,
          prior_claim_id_value
        );
      end if;
    end loop;
    for prior_claim_id_value in
      select value
      from jsonb_array_elements_text(prior_intelligence.conflict_keys_json)
    loop
      if prior_claim_id_value <> all(conflict_keys) then
        conflict_keys := array_append(conflict_keys, prior_claim_id_value);
      end if;
    end loop;
  end if;

  for claim_item in
    select item
    from jsonb_array_elements(target_claims) item
    order by item->>'id'
  loop
    saved_claim_id := (claim_item->>'id')::uuid;
    if saved_claim_id = any(claim_ids)
      or saved_claim_id = any(new_claim_ids)
      or nullif(trim(claim_item->>'key'), '') is null
      or nullif(trim(claim_item->>'fieldPath'), '') is null
      or nullif(trim(claim_item->>'statement'), '') is null
      or claim_item->>'status' not in (
        'confirmed_fact',
        'evidence_backed_inference',
        'hypothesis',
        'unknown',
        'conflicting'
      )
      or claim_item->>'freshnessClass' not in (
        'stable', 'slow_changing', 'dynamic', 'volatile'
      )
      or claim_item->>'sourceScope' not in (
        'system_public', 'workspace_private'
      )
      or claim_item->>'reusableScope' not in (
        'organization', 'offering_context', 'campaign_only'
      )
      or not exists (
        select 1
        from jsonb_array_elements(research_plan.questions_json) question
        where question->>'key' = claim_item->>'key'
      )
    then
      raise exception 'Invalid Candidate Research claim.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(claim_item->'evidenceIds', '[]'::jsonb)
      ) item(value)
      where not exists (
        select 1
        from public.candidate_research_member_sources_v2 member_source
        where member_source.candidate_research_member_id = member.id
          and member_source.evidence_id = item.value::uuid
      )
    ) then
      raise exception 'Candidate Research claim contains foreign evidence.';
    end if;
    if claim_item->>'status' = 'confirmed_fact'
      and jsonb_array_length(
        coalesce(claim_item->'evidenceIds', '[]'::jsonb)
      ) = 0
    then
      raise exception 'Confirmed Candidate facts require evidence.';
    end if;
    claim_status := case claim_item->>'status'
      when 'confirmed_fact' then 'explicit_fact'
      when 'evidence_backed_inference' then 'evidence_backed_inference'
      when 'hypothesis' then 'hypothesis'
      when 'conflicting' then 'conflict'
      else 'unknown'
    end;
    select exists (
      select 1
      from jsonb_array_elements(target_question_findings) finding
      where finding->>'questionKey' = claim_item->>'key'
        and finding->>'state' = 'conflicting'
    )
    into claim_is_conflicting;
    insert into public.intelligence_claims (
      id,
      workspace_id,
      subject_type,
      subject_id,
      claim_key,
      field_path,
      statement,
      value_json,
      epistemic_status,
      lifecycle_status,
      confidence,
      origin_type,
      origin_id,
      concise_rationale,
      observed_at,
      freshness_class,
      source_scope
    ) values (
      saved_claim_id,
      target_workspace_id,
      'organization',
      member.organization_id,
      claim_item->>'key',
      claim_item->>'fieldPath',
      claim_item->>'statement',
      claim_item->'value',
      claim_status,
      'active',
      (claim_item->>'confidence')::numeric,
      case
        when claim_status = 'explicit_fact' then 'official_source'
        else 'ai_inference'
      end,
      ai_origin_id,
      case
        when claim_status in ('evidence_backed_inference', 'conflict')
          then left(claim_item->>'statement', 600)
        else null
      end,
      now(),
      claim_item->>'freshnessClass',
      claim_item->>'sourceScope'
    );
    for evidence_id_value in
      select value
      from jsonb_array_elements_text(
        coalesce(claim_item->'evidenceIds', '[]'::jsonb)
      )
    loop
      insert into public.claim_evidence_links (
        claim_id,
        evidence_id,
        workspace_id,
        stance,
        weight
      ) values (
        saved_claim_id,
        evidence_id_value::uuid,
        target_workspace_id,
        case
          when claim_status = 'conflict' then 'contradicts'
          else 'supports'
        end,
        (claim_item->>'confidence')::numeric
      );
    end loop;
    if claim_item->>'reusableScope' = 'organization' then
      insert into public.candidate_claims (
        workspace_id,
        organization_id,
        intelligence_claim_id,
        freshness_state,
        reusable_status
      ) values (
        target_workspace_id,
        member.organization_id,
        saved_claim_id,
        'current',
        case
          when claim_status = 'conflict' or claim_is_conflicting
            then 'conflicting'
          else 'active'
        end
      );
      if claim_status <> 'unknown' and not claim_is_conflicting then
        update public.candidate_claims existing_candidate_claim
        set reusable_status = 'superseded'
        from public.intelligence_claims existing_claim
        where existing_candidate_claim.workspace_id = target_workspace_id
          and existing_candidate_claim.organization_id =
            member.organization_id
          and existing_candidate_claim.intelligence_claim_id =
            existing_claim.id
          and existing_candidate_claim.intelligence_claim_id <>
            saved_claim_id
          and existing_candidate_claim.reusable_status in (
            'active', 'conflicting'
          )
          and existing_claim.claim_key = claim_item->>'key';
      end if;
      claim_ids := array_append(claim_ids, saved_claim_id);
      for evidence_id_value in
        select value
        from jsonb_array_elements_text(
          coalesce(claim_item->'evidenceIds', '[]'::jsonb)
        )
      loop
        if evidence_id_value::uuid <> all(evidence_ids) then
          evidence_ids := array_append(evidence_ids, evidence_id_value::uuid);
        end if;
      end loop;
    end if;
    if claim_item->>'reusableScope' <> 'organization' then
      insert into public.campaign_candidate_claims (
        workspace_id,
        campaign_candidate_id,
        intelligence_claim_id,
        campaign_strategy_version_id,
        claim_scope
      ) values (
        target_workspace_id,
        member.campaign_candidate_id,
        saved_claim_id,
        research_plan.campaign_strategy_version_id,
        claim_item->>'reusableScope'
      );
    end if;
    new_claim_ids := array_append(new_claim_ids, saved_claim_id);
  end loop;

  for finding_item in
    select item
    from jsonb_array_elements(target_question_findings) item
    order by item->>'questionKey'
  loop
    if finding_item->>'state' not in (
      'answered_positive', 'answered_negative', 'unknown', 'conflicting'
    ) or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(finding_item->'claimIds', '[]'::jsonb)
      ) claim_id(value)
      where claim_id.value::uuid <> all(new_claim_ids)
    ) or exists (
      select 1
      from jsonb_array_elements_text(
        coalesce(finding_item->'evidenceIds', '[]'::jsonb)
      ) evidence_id(value)
      where evidence_id.value::uuid <> all(source_evidence_ids)
    )
    then
      raise exception 'Candidate Research finding contains foreign references.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(research_plan.questions_json) question
      where question->>'key' = finding_item->>'questionKey'
        and question->>'reusableScope' = 'organization'
    ) then
      unresolved_keys := array_remove(
        unresolved_keys,
        finding_item->>'questionKey'
      );
      conflict_keys := array_remove(
        conflict_keys,
        finding_item->>'questionKey'
      );
      if finding_item->>'state' in ('unknown', 'conflicting') then
        unresolved_keys := array_append(
          unresolved_keys,
          finding_item->>'questionKey'
        );
      end if;
      if finding_item->>'state' = 'conflicting' then
        conflict_keys := array_append(
          conflict_keys,
          finding_item->>'questionKey'
        );
      end if;
    end if;
  end loop;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'candidate-intelligence:' || member.organization_id::text,
      0
    )
  );
  select coalesce(max(version_number), 0) + 1
  into next_version
  from public.candidate_intelligence_versions
  where organization_id = member.organization_id;
  select max(evidence.retrieved_at)
  into source_cutoff
  from public.evidence_items evidence
  where evidence.id = any(evidence_ids);
  source_cutoff := coalesce(
    greatest(source_cutoff, prior_intelligence.source_cutoff_at),
    source_cutoff,
    prior_intelligence.source_cutoff_at,
    now()
  );
  snapshot := jsonb_build_object(
    'organizationId', member.organization_id,
    'versionNumber', next_version,
    'sourceCutoffAt', source_cutoff,
    'claims', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', intelligence_claim.id,
          'key', intelligence_claim.claim_key,
          'fieldPath', intelligence_claim.field_path,
          'statement', intelligence_claim.statement,
          'value', intelligence_claim.value_json,
          'status', case intelligence_claim.epistemic_status
            when 'explicit_fact' then 'confirmed_fact'
            when 'evidence_backed_inference'
              then 'evidence_backed_inference'
            when 'hypothesis' then 'hypothesis'
            when 'conflict' then 'conflicting'
            else 'unknown'
          end,
          'confidence', intelligence_claim.confidence,
          'evidenceIds', coalesce((
            select jsonb_agg(
              claim_evidence.evidence_id
              order by claim_evidence.evidence_id
            )
            from public.claim_evidence_links claim_evidence
            where claim_evidence.claim_id = intelligence_claim.id
          ), '[]'::jsonb),
          'freshnessClass', intelligence_claim.freshness_class,
          'sourceScope', intelligence_claim.source_scope,
          'reusableScope', coalesce((
            select campaign_claim.claim_scope
            from public.campaign_candidate_claims campaign_claim
            where campaign_claim.campaign_candidate_id =
              member.campaign_candidate_id
              and campaign_claim.intelligence_claim_id =
                intelligence_claim.id
              and campaign_claim.campaign_strategy_version_id =
                research_plan.campaign_strategy_version_id
            limit 1
          ), 'organization')
        )
        order by intelligence_claim.claim_key, intelligence_claim.id
      )
      from public.intelligence_claims intelligence_claim
      where intelligence_claim.id = any(claim_ids)
    ), '[]'::jsonb),
    'questionFindings', coalesce((
      select jsonb_agg(finding order by finding->>'questionKey')
      from jsonb_array_elements(target_question_findings) finding
      where exists (
        select 1
        from jsonb_array_elements(research_plan.questions_json) question
        where question->>'key' = finding->>'questionKey'
          and question->>'reusableScope' = 'organization'
      )
    ), '[]'::jsonb),
    'unresolvedQuestionKeys', to_jsonb(unresolved_keys),
    'conflictKeys', to_jsonb(conflict_keys),
    'researchPlanId', research_plan.id,
    'researchPlanContentHash', research_plan.content_hash
  );
  content_hash := encode(digest(snapshot::text, 'sha256'), 'hex');
  insert into public.candidate_intelligence_versions (
    workspace_id,
    organization_id,
    version_number,
    source_cutoff_at,
    compiled_snapshot_json,
    claim_ids_json,
    evidence_ids_json,
    unresolved_question_keys_json,
    conflict_keys_json,
    content_hash
  ) values (
    target_workspace_id,
    member.organization_id,
    next_version,
    source_cutoff,
    snapshot,
    to_jsonb(claim_ids),
    to_jsonb(evidence_ids),
    to_jsonb(unresolved_keys),
    to_jsonb(conflict_keys),
    content_hash
  )
  returning * into intelligence_version;

  output_reference := jsonb_build_object(
    'schemaVersion', 2,
    'memberId', member.id,
    'campaignCandidateId', member.campaign_candidate_id,
    'status', case
      when target_access_blocked then 'blocked'
      else 'completed'
    end,
    'intelligenceVersionId', intelligence_version.id,
    'claimCount', cardinality(claim_ids),
    'evidenceCount', cardinality(evidence_ids),
    'unresolvedQuestionCount', cardinality(unresolved_keys),
    'aiRequestIds', target_ai_request_ids,
    'cached', false
  );
  update public.candidate_research_batch_members_v2
  set
    status = case
      when target_access_blocked then 'blocked'
      else 'completed'
    end,
    extraction_request_hash = target_extraction_request_hash,
    intelligence_version_id = intelligence_version.id,
    output_reference_json = output_reference,
    completed_at = now()
  where id = member.id;
  update public.candidate_research_plans
  set status = case
    when target_access_blocked then 'blocked'
    else 'completed'
  end
  where id = research_plan.id;
  update public.campaign_candidates
  set
    current_intelligence_version_id = intelligence_version.id,
    state = case
      when target_access_blocked then 'research_blocked'
      else 'ready_for_evaluation'
    end,
    updated_at = now()
  where id = member.campaign_candidate_id;
  insert into public.candidate_research_tasks (
    workspace_id,
    research_plan_id,
    question_key,
    task_type,
    status,
    priority,
    idempotency_key,
    result_reference_json,
    started_at,
    completed_at
  ) values (
    target_workspace_id,
    research_plan.id,
    '__compile__',
    'compile_intelligence',
    'completed',
    100,
    'compile:' || target_extraction_request_hash,
    jsonb_build_object(
      'intelligenceVersionId', intelligence_version.id,
      'contentHash', intelligence_version.content_hash,
      'questionFindings', target_question_findings,
      'missingEvidence', target_missing_evidence
    ),
    now(),
    now()
  )
  on conflict (research_plan_id, idempotency_key) do nothing;
  return output_reference;
end;
$$;

create or replace function public.finalize_candidate_research_batch_v2(
  target_workspace_id uuid,
  target_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  research_batch public.candidate_research_batches_v2;
  settled_completed_count integer;
  settled_blocked_count integer;
  settled_evidence_count integer;
  settled_claim_count integer;
  settled_unresolved_count integer;
  summary jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  select *
  into research_batch
  from public.candidate_research_batches_v2
  where id = target_batch_id
    and workspace_id = target_workspace_id
  for update;
  if research_batch.id is null then
    raise exception 'Candidate Research batch not found.';
  end if;
  if research_batch.status in ('completed', 'partial') then
    return research_batch.summary_json;
  end if;
  if exists (
    select 1
    from public.candidate_research_batch_members_v2 member
    where member.candidate_research_batch_id = research_batch.id
      and member.status not in ('completed', 'blocked')
  ) then
    raise exception 'Candidate Research batch still has unsettled members.';
  end if;

  select
    count(*) filter (where member.status = 'completed')::integer,
    count(*) filter (where member.status = 'blocked')::integer,
    coalesce(sum(
      (member.output_reference_json->>'evidenceCount')::integer
    ), 0)::integer,
    coalesce(sum(
      (member.output_reference_json->>'claimCount')::integer
    ), 0)::integer,
    coalesce(sum(
      (member.output_reference_json->>'unresolvedQuestionCount')::integer
    ), 0)::integer
  into
    settled_completed_count,
    settled_blocked_count,
    settled_evidence_count,
    settled_claim_count,
    settled_unresolved_count
  from public.candidate_research_batch_members_v2 member
  where member.candidate_research_batch_id = research_batch.id;

  summary := jsonb_build_object(
    'schemaVersion', 2,
    'batchId', research_batch.id,
    'campaignRunId', research_batch.campaign_run_id,
    'status', case
      when settled_blocked_count > 0 then 'partial'
      else 'completed'
    end,
    'candidateCount', research_batch.candidate_count,
    'completedCount', settled_completed_count,
    'blockedCount', settled_blocked_count,
    'evidenceCount', settled_evidence_count,
    'claimCount', settled_claim_count,
    'unresolvedQuestionCount', settled_unresolved_count,
    'intelligenceVersionIds', coalesce((
      select jsonb_agg(member.intelligence_version_id order by member.id)
      from public.candidate_research_batch_members_v2 member
      where member.candidate_research_batch_id = research_batch.id
        and member.intelligence_version_id is not null
    ), '[]'::jsonb),
    'aiRequestIds', coalesce((
      select jsonb_agg(distinct ai_request_id.value order by ai_request_id.value)
      from public.candidate_research_batch_members_v2 member,
      lateral jsonb_array_elements_text(
        member.output_reference_json->'aiRequestIds'
      ) ai_request_id(value)
      where member.candidate_research_batch_id = research_batch.id
    ), '[]'::jsonb)
  );
  update public.candidate_research_batches_v2
  set
    status = case
      when settled_blocked_count > 0 then 'partial'
      else 'completed'
    end,
    completed_count = settled_completed_count,
    blocked_count = settled_blocked_count,
    summary_json = summary,
    completed_at = now()
  where id = research_batch.id;
  return summary;
end;
$$;

revoke all on function public.load_campaign_candidate_research_inputs_v2(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.initialize_candidate_research_batch_v2(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.claim_candidate_research_member_v2(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.persist_candidate_research_source_v2(
  uuid, uuid, text, uuid, text, text, text, text, timestamptz
) from public, anon, authenticated;
revoke all on function public.save_candidate_research_extraction_v2(
  uuid, uuid, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_candidate_research_member_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean
) from public, anon, authenticated;
revoke all on function public.finalize_candidate_research_batch_v2(
  uuid, uuid
) from public, anon, authenticated;

grant execute on function public.load_campaign_candidate_research_inputs_v2(
  uuid, uuid
) to service_role;
grant execute on function public.initialize_candidate_research_batch_v2(
  uuid, uuid, text, text, jsonb
) to service_role;
grant execute on function public.claim_candidate_research_member_v2(
  uuid, uuid, text
) to service_role;
grant execute on function public.persist_candidate_research_source_v2(
  uuid, uuid, text, uuid, text, text, text, text, timestamptz
) to service_role;
grant execute on function public.save_candidate_research_extraction_v2(
  uuid, uuid, text, jsonb, jsonb
) to service_role;
grant execute on function public.complete_candidate_research_member_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean
) to service_role;
grant execute on function public.finalize_candidate_research_batch_v2(
  uuid, uuid
) to service_role;
