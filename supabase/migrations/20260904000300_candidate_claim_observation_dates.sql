-- Explicit Candidate Research completion function with source observation-date handling.
-- Apply after 20260904000200_candidate_supporting_research_sources.sql.

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
set search_path = public, extensions
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
  saved_intelligence_version public.candidate_intelligence_versions;
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
      case when claim_status = 'unknown' then null else claim_item->'value' end,
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
      case
        when claim_item ? 'observedAt'
          then nullif(claim_item->>'observedAt', '')::timestamptz
        when claim_item->>'freshnessClass' = 'volatile' then null
        else now()
      end,
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
        case
          when claim_item->>'freshnessClass' = 'volatile'
            and not (claim_item ? 'observedAt') then 'unknown'
          else 'current'
        end,
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
  returning * into saved_intelligence_version;

  output_reference := jsonb_build_object(
    'schemaVersion', 2,
    'memberId', member.id,
    'campaignCandidateId', member.campaign_candidate_id,
    'status', case
      when target_access_blocked then 'blocked'
      else 'completed'
    end,
    'intelligenceVersionId', saved_intelligence_version.id,
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
    intelligence_version_id = saved_intelligence_version.id,
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
    current_intelligence_version_id = saved_intelligence_version.id,
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
      'intelligenceVersionId', saved_intelligence_version.id,
      'contentHash', saved_intelligence_version.content_hash,
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

revoke all on function public.complete_candidate_research_member_v2(
  uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean
) from public, anon, authenticated;
grant execute on function public.complete_candidate_research_member_v2(
  uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean
) to service_role;
