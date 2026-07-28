-- Retry-safe Qualification V2 runtime, part 2 of 2.
-- Apply after 20260728002500_retry_safe_candidate_qualification_stage.sql.

create or replace function public.claim_candidate_qualification_member_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_trigger_run_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_qualification_batch_members_v2;
  qualification_batch public.candidate_qualification_batches_v2;
  campaign_candidate public.campaign_candidates;
  strategy_version public.campaign_strategy_versions;
  intelligence_version public.candidate_intelligence_versions;
  research_member public.candidate_research_batch_members_v2;
  research_task public.candidate_research_tasks;
  claim_ids uuid[];
  evidence_ids uuid[];
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  select *
  into member
  from public.candidate_qualification_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null then
    raise exception 'Qualification member not found.';
  end if;
  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where id = member.candidate_qualification_batch_id
    and workspace_id = target_workspace_id;
  select *
  into campaign_candidate
  from public.campaign_candidates
  where id = member.campaign_candidate_id
    and workspace_id = target_workspace_id;
  select *
  into strategy_version
  from public.campaign_strategy_versions
  where id = qualification_batch.campaign_strategy_version_id
    and workspace_id = target_workspace_id
    and confirmation_status = 'confirmed';
  select *
  into intelligence_version
  from public.candidate_intelligence_versions
  where id = member.candidate_intelligence_version_id
    and workspace_id = target_workspace_id
    and organization_id = campaign_candidate.organization_id;
  select *
  into research_member
  from public.candidate_research_batch_members_v2
  where candidate_research_batch_id =
      qualification_batch.candidate_research_batch_id
    and campaign_candidate_id = member.campaign_candidate_id
    and intelligence_version_id = member.candidate_intelligence_version_id
    and status in ('completed', 'blocked');
  if qualification_batch.id is null
    or campaign_candidate.id is null
    or strategy_version.id is null
    or intelligence_version.id is null
    or research_member.id is null
  then
    raise exception 'Qualification member context is incomplete.';
  end if;

  if member.status in ('queued', 'running') then
    update public.candidate_qualification_batch_members_v2
    set
      status = 'running',
      attempt_count = attempt_count + 1,
      trigger_run_id = target_trigger_run_id,
      started_at = coalesce(started_at, now()),
      error_code = null,
      error_message = null
    where id = member.id
    returning * into member;
    update public.candidate_evaluation_versions
    set status = 'relationship_classifying'
    where id = member.candidate_evaluation_version_id
      and status in (
        'pending', 'relationship_classifying', 'factor_evaluating',
        'scoring'
      );
  end if;

  select coalesce(
    array_agg(distinct claim_id order by claim_id),
    '{}'::uuid[]
  )
  into claim_ids
  from (
    select value::uuid as claim_id
    from jsonb_array_elements_text(
      intelligence_version.claim_ids_json
    ) claim_id(value)
    union
    select campaign_claim.intelligence_claim_id
    from public.campaign_candidate_claims campaign_claim
    where campaign_claim.workspace_id = target_workspace_id
      and campaign_claim.campaign_candidate_id =
        campaign_candidate.id
      and campaign_claim.campaign_strategy_version_id =
        qualification_batch.campaign_strategy_version_id
  ) frozen_claims;

  select coalesce(
    array_agg(distinct claim_evidence.evidence_id
      order by claim_evidence.evidence_id),
    '{}'::uuid[]
  )
  into evidence_ids
  from public.claim_evidence_links claim_evidence
  where claim_evidence.claim_id = any(claim_ids);

  select *
  into research_task
  from public.candidate_research_tasks task
  where task.research_plan_id = research_member.research_plan_id
    and task.task_type = 'compile_intelligence'
    and task.status = 'completed'
  order by task.completed_at desc, task.id desc
  limit 1;

  return jsonb_build_object(
    'schemaVersion', 2,
    'batchId', qualification_batch.id,
    'memberId', member.id,
    'workspaceId', target_workspace_id,
    'campaignRunId', qualification_batch.campaign_run_id,
    'campaignId', qualification_batch.campaign_id,
    'strategyVersionId',
      qualification_batch.campaign_strategy_version_id,
    'campaignCandidateId', member.campaign_candidate_id,
    'evaluationVersionId',
      member.candidate_evaluation_version_id,
    'candidateIntelligenceVersionId',
      member.candidate_intelligence_version_id,
    'inputHash', member.input_hash,
    'status', member.status,
    'objective', strategy_version.strategy->'objective',
    'organization', member.input_snapshot_json->'organization',
    'candidateState',
      member.input_snapshot_json->>'candidateState',
    'validEntity',
      (member.input_snapshot_json->>'validEntity')::boolean,
    'merged',
      (member.input_snapshot_json->>'merged')::boolean,
    'procurementAutonomy',
      member.input_snapshot_json->>'procurementAutonomy',
    'procurementConfidence',
      (member.input_snapshot_json->>'procurementConfidence')::numeric,
    'procurementCritical',
      (member.input_snapshot_json->>'procurementCritical')::boolean,
    'rubric', qualification_batch.rubric_json,
    'claims', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', intelligence_claim.id,
          'key', intelligence_claim.claim_key,
          'statement', intelligence_claim.statement,
          'value', intelligence_claim.value_json,
          'epistemicStatus', intelligence_claim.epistemic_status,
          'confidence', intelligence_claim.confidence,
          'evidenceIds', coalesce((
            select jsonb_agg(
              claim_evidence.evidence_id
              order by claim_evidence.evidence_id
            )
            from public.claim_evidence_links claim_evidence
            where claim_evidence.claim_id = intelligence_claim.id
          ), '[]'::jsonb)
        )
        order by intelligence_claim.claim_key, intelligence_claim.id
      )
      from public.intelligence_claims intelligence_claim
      where intelligence_claim.workspace_id = target_workspace_id
        and intelligence_claim.id = any(claim_ids)
        and intelligence_claim.lifecycle_status in ('active', 'user_confirmed')
    ), '[]'::jsonb),
    'evidence', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', evidence.id,
          'evidenceType', evidence.evidence_type,
          'excerpt', evidence.excerpt,
          'directness', evidence.directness,
          'sourceReliability', evidence.source_reliability,
          'freshnessState', evidence.freshness_state
        )
        order by evidence.id
      )
      from public.evidence_items evidence
      where evidence.workspace_id = target_workspace_id
        and evidence.id = any(evidence_ids)
    ), '[]'::jsonb),
    'questionFindings', coalesce(
      research_task.result_reference_json->'questionFindings',
      '[]'::jsonb
    ),
    'cachedOutputs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'taskType', cached_output.task_type,
          'requestHash', cached_output.request_hash,
          'output', cached_output.output_json,
          'aiRequestId', cached_output.ai_request_id
        )
        order by cached_output.task_type, cached_output.request_hash
      )
      from public.candidate_qualification_ai_outputs_v2 cached_output
      where cached_output.workspace_id = target_workspace_id
        and cached_output.candidate_qualification_member_id = member.id
    ), '[]'::jsonb),
    'outputReference', member.output_reference_json
  );
end;
$$;

create or replace function public.save_candidate_qualification_ai_output_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_task_type text,
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
  member public.candidate_qualification_batch_members_v2;
  qualification_batch public.candidate_qualification_batches_v2;
  existing_output public.candidate_qualification_ai_outputs_v2;
  saved_output public.candidate_qualification_ai_outputs_v2;
  saved_ai_request public.ai_requests;
  prompt_version text;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if target_task_type not in ('relationship', 'factors')
    or length(target_request_hash) <> 64
    or jsonb_typeof(target_output) <> 'object'
    or jsonb_typeof(target_ai_request) <> 'object'
  then
    raise exception 'Invalid Qualification AI output.';
  end if;
  select *
  into member
  from public.candidate_qualification_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null or member.status <> 'running' then
    raise exception 'Qualification member is not running.';
  end if;
  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where id = member.candidate_qualification_batch_id
    and workspace_id = target_workspace_id;
  select *
  into existing_output
  from public.candidate_qualification_ai_outputs_v2
  where candidate_qualification_member_id = member.id
    and task_type = target_task_type
    and request_hash = target_request_hash;
  if existing_output.id is not null then
    if existing_output.output_json <> target_output then
      raise exception 'Cached Qualification AI output changed.';
    end if;
    return jsonb_build_object(
      'taskType', existing_output.task_type,
      'requestHash', existing_output.request_hash,
      'output', existing_output.output_json,
      'aiRequestId', existing_output.ai_request_id
    );
  end if;

  prompt_version := case target_task_type
    when 'relationship'
      then 'candidate-relationship-classification-v2.1'
    else 'candidate-factor-evaluation-v2.1'
  end;
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
    qualification_batch.campaign_run_id,
    case target_task_type
      when 'relationship'
        then 'candidate.relationship_classification'
      else 'candidate.factor_evaluation'
    end,
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
    prompt_version,
    prompt_version,
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
      'candidateQualificationMemberId', member.id,
      'campaignCandidateId', member.campaign_candidate_id,
      'candidateEvaluationVersionId',
        member.candidate_evaluation_version_id,
      'providerRequestId', target_ai_request->>'providerRequestId',
      'latencyMs',
        nullif(target_ai_request->>'latencyMs', '')::integer,
      'fallbackReason', target_ai_request->>'fallbackReason',
      'responseHash',
        encode(digest(target_output::text, 'sha256'), 'hex')
    ),
    coalesce(
      nullif(target_ai_request->>'startedAt', '')::timestamptz,
      now()
    ),
    now()
  )
  returning * into saved_ai_request;

  insert into public.candidate_qualification_ai_outputs_v2 (
    workspace_id,
    candidate_qualification_member_id,
    task_type,
    request_hash,
    output_json,
    ai_request_id
  ) values (
    target_workspace_id,
    member.id,
    target_task_type,
    target_request_hash,
    target_output,
    saved_ai_request.id
  )
  returning * into saved_output;

  update public.candidate_evaluation_versions
  set status = case target_task_type
    when 'relationship' then 'factor_evaluating'
    else 'scoring'
  end
  where id = member.candidate_evaluation_version_id
    and status not in (
      'comparative_pending', 'finalized', 'requires_manual_review',
      'failed', 'superseded'
    );

  return jsonb_build_object(
    'taskType', saved_output.task_type,
    'requestHash', saved_output.request_hash,
    'output', saved_output.output_json,
    'aiRequestId', saved_output.ai_request_id
  );
end;
$$;

create or replace function public.complete_candidate_qualification_member_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_relationship_request_hash text,
  target_factor_request_hash text,
  target_relationship jsonb,
  target_exclusions jsonb,
  target_factors jsonb,
  target_fit jsonb,
  target_potential jsonb,
  target_confidence jsonb,
  target_eligibility jsonb,
  target_lane jsonb,
  target_explanation text,
  target_ai_request_ids jsonb,
  target_final_snapshot jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_qualification_batch_members_v2;
  qualification_batch public.candidate_qualification_batches_v2;
  evaluation_version public.candidate_evaluation_versions;
  exclusion_item jsonb;
  factor_item jsonb;
  output_reference jsonb;
  expected_factor_count integer;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if length(target_relationship_request_hash) <> 64
    or length(target_factor_request_hash) <> 64
    or jsonb_typeof(target_relationship) <> 'object'
    or jsonb_typeof(target_exclusions) <> 'array'
    or jsonb_typeof(target_factors) <> 'array'
    or jsonb_typeof(target_fit) <> 'object'
    or jsonb_typeof(target_potential) <> 'object'
    or jsonb_typeof(target_confidence) <> 'object'
    or jsonb_typeof(target_eligibility) <> 'object'
    or jsonb_typeof(target_lane) <> 'object'
    or jsonb_typeof(target_ai_request_ids) <> 'array'
    or jsonb_typeof(target_final_snapshot) <> 'object'
    or nullif(trim(target_explanation), '') is null
    or length(target_explanation) > 1600
  then
    raise exception 'Invalid Qualification completion payload.';
  end if;
  select *
  into member
  from public.candidate_qualification_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null then
    raise exception 'Qualification member not found.';
  end if;
  if member.status in ('completed', 'blocked') then
    return member.output_reference_json;
  end if;
  if member.status <> 'running' then
    raise exception 'Qualification member is not running.';
  end if;
  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where id = member.candidate_qualification_batch_id
    and workspace_id = target_workspace_id;
  select *
  into evaluation_version
  from public.candidate_evaluation_versions
  where id = member.candidate_evaluation_version_id
    and workspace_id = target_workspace_id
  for update;
  if qualification_batch.id is null or evaluation_version.id is null then
    raise exception 'Qualification completion context is incomplete.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(target_ai_request_ids) ai_request_id(value)
    where not exists (
      select 1
      from public.candidate_qualification_ai_outputs_v2 cached_output
      where cached_output.candidate_qualification_member_id = member.id
        and cached_output.ai_request_id = ai_request_id.value::uuid
    )
  ) then
    raise exception 'Qualification completion contains a foreign AI request.';
  end if;
  select jsonb_array_length(
    qualification_batch.rubric_json->'factors'
  )
  into expected_factor_count;
  if jsonb_array_length(target_factors) <> expected_factor_count
    or (
      select count(distinct factor->>'factorKey')
      from jsonb_array_elements(target_factors) factor
    ) <> expected_factor_count
    or exists (
      select 1
      from jsonb_array_elements(target_factors) factor
      where not exists (
        select 1
        from jsonb_array_elements(
          qualification_batch.rubric_json->'factors'
        ) rubric_factor
        where rubric_factor->>'key' = factor->>'factorKey'
      )
    )
  then
    raise exception 'Qualification factors do not match the frozen rubric.';
  end if;

  insert into public.candidate_relationship_assessments (
    workspace_id,
    candidate_evaluation_version_id,
    primary_relationship,
    secondary_relationships_json,
    confidence,
    decision_basis,
    evidence_ids_json,
    counter_evidence_ids_json,
    unresolved_questions_json,
    objective_compatibility,
    concise_rationale,
    classifier_version
  ) values (
    target_workspace_id,
    evaluation_version.id,
    target_relationship->>'primaryRelationship',
    target_relationship->'secondaryRelationships',
    (target_relationship->>'confidence')::numeric,
    target_relationship->>'decisionBasis',
    target_relationship->'evidenceIds',
    target_relationship->'counterEvidenceIds',
    target_relationship->'unresolvedQuestions',
    target_relationship->>'objectiveCompatibility',
    target_relationship->>'conciseRationale',
    qualification_batch.rubric_json->>'relationshipClassifierVersion'
  );

  for exclusion_item in
    select item
    from jsonb_array_elements(target_exclusions) item
    order by item->>'ruleId'
  loop
    if not exists (
      select 1
      from jsonb_array_elements(
        qualification_batch.rubric_json->'hardExclusionRules'
      ) rubric_rule
      where rubric_rule->>'ruleKey' = exclusion_item->>'ruleId'
    ) then
      raise exception 'Qualification exclusion is outside the frozen rubric.';
    end if;
    insert into public.candidate_exclusion_assessments (
      workspace_id,
      candidate_evaluation_version_id,
      rule_key,
      state,
      strength,
      confidence,
      effect,
      evidence_ids_json,
      counter_evidence_ids_json,
      reason
    ) values (
      target_workspace_id,
      evaluation_version.id,
      exclusion_item->>'ruleId',
      exclusion_item->>'state',
      exclusion_item->>'strength',
      (exclusion_item->>'confidence')::numeric,
      exclusion_item->>'effect',
      exclusion_item->'evidenceIds',
      coalesce(exclusion_item->'counterEvidenceIds', '[]'::jsonb),
      exclusion_item->>'reason'
    );
  end loop;

  for factor_item in
    select item
    from jsonb_array_elements(target_factors) item
    order by item->>'factorKey'
  loop
    insert into public.candidate_factor_evaluations (
      workspace_id,
      candidate_evaluation_version_id,
      factor_key,
      state,
      signed_value,
      potential_value,
      confidence,
      evidence_quality,
      critical_gate_state,
      evidence_ids_json,
      counter_evidence_ids_json,
      explanation,
      missing_evidence_json,
      evaluator_version
    ) values (
      target_workspace_id,
      evaluation_version.id,
      factor_item->>'factorKey',
      factor_item->>'state',
      nullif(factor_item->>'signedValue', '')::numeric,
      nullif(factor_item->>'potentialValue', '')::numeric,
      (factor_item->>'confidence')::numeric,
      (factor_item->>'evidenceQuality')::numeric,
      nullif(factor_item->>'criticalGateState', ''),
      factor_item->'evidenceIds',
      factor_item->'counterEvidenceIds',
      factor_item->>'explanation',
      factor_item->'missingEvidence',
      'candidate-factor-evaluation-v2.1'
    );
  end loop;

  insert into public.candidate_score_calculations (
    workspace_id,
    candidate_evaluation_version_id,
    score_type,
    score,
    raw_weighted_mean,
    denominator,
    trace_json,
    policy_version
  ) values
  (
    target_workspace_id,
    evaluation_version.id,
    'fit',
    nullif(target_fit->>'score', '')::integer,
    nullif(target_fit->>'rawWeightedMean', '')::numeric,
    (target_fit->>'denominator')::numeric,
    jsonb_build_object(
      'includedFactorKeys', target_fit->'includedFactorKeys',
      'excludedFactorKeys', target_fit->'excludedFactorKeys',
      'items', target_fit->'trace'
    ),
    qualification_batch.rubric_json->>'scoringPolicyVersion'
  ),
  (
    target_workspace_id,
    evaluation_version.id,
    'commercial_potential',
    nullif(target_potential->>'score', '')::integer,
    nullif(target_potential->>'rawWeightedMean', '')::numeric,
    (target_potential->>'denominator')::numeric,
    jsonb_build_object(
      'includedFactorKeys', target_potential->'includedFactorKeys',
      'excludedFactorKeys', target_potential->'excludedFactorKeys',
      'items', target_potential->'trace'
    ),
    qualification_batch.rubric_json->>'scoringPolicyVersion'
  );

  insert into public.candidate_confidence_calculations (
    workspace_id,
    candidate_evaluation_version_id,
    overall_confidence,
    components_json,
    caps_json,
    policy_version
  ) values (
    target_workspace_id,
    evaluation_version.id,
    (target_confidence->>'score')::integer,
    jsonb_build_object(
      'evidenceCoverage', target_confidence->'evidenceCoverage',
      'evidenceQuality', target_confidence->'evidenceQuality',
      'evidenceConsistency', target_confidence->'evidenceConsistency'
    ),
    target_confidence->'caps',
    'qualification-confidence-v2.1'
  );

  insert into public.candidate_eligibility_decisions (
    workspace_id,
    candidate_evaluation_version_id,
    eligibility,
    reason_code,
    reason_text,
    decided_by
  ) values (
    target_workspace_id,
    evaluation_version.id,
    target_eligibility->>'state',
    target_eligibility->>'reasonCode',
    target_eligibility->>'reasonText',
    target_eligibility->>'decidedBy'
  );

  insert into public.candidate_review_lane_assignments (
    workspace_id,
    candidate_evaluation_version_id,
    lane,
    reason
  ) values (
    target_workspace_id,
    evaluation_version.id,
    target_lane->>'lane',
    target_lane->>'reason'
  );

  insert into public.candidate_explanations (
    workspace_id,
    candidate_evaluation_version_id,
    summary,
    evidence_ids_json,
    explanation_version
  ) values (
    target_workspace_id,
    evaluation_version.id,
    target_explanation,
    coalesce((
      select jsonb_agg(distinct evidence_id order by evidence_id)
      from (
        select jsonb_array_elements_text(
          target_relationship->'evidenceIds'
        ) evidence_id
        union
        select jsonb_array_elements_text(
          factor->'evidenceIds'
        ) evidence_id
        from jsonb_array_elements(target_factors) factor
      ) explanation_evidence
    ), '[]'::jsonb),
    'qualification-explanation-v2.1'
  );

  insert into public.candidate_evaluation_events (
    workspace_id,
    candidate_evaluation_version_id,
    event_type,
    event_payload_json
  ) values (
    target_workspace_id,
    evaluation_version.id,
    'qualification_completed',
    jsonb_build_object(
      'relationshipRequestHash', target_relationship_request_hash,
      'factorRequestHash', target_factor_request_hash,
      'eligibility', target_eligibility->>'state',
      'lane', target_lane->>'lane',
      'fitScore', target_fit->'score',
      'potentialScore', target_potential->'score',
      'confidence', target_confidence->'score',
      'aiRequestIds', target_ai_request_ids
    )
  );

  update public.candidate_evaluation_versions
  set
    status = 'comparative_pending',
    compiled_snapshot_json = target_final_snapshot
  where id = evaluation_version.id;

  output_reference := jsonb_build_object(
    'schemaVersion', 2,
    'memberId', member.id,
    'campaignCandidateId', member.campaign_candidate_id,
    'evaluationVersionId', evaluation_version.id,
    'status', 'completed',
    'eligibility', target_eligibility->>'state',
    'lane', target_lane->>'lane',
    'fitScore', target_fit->'score',
    'potentialScore', target_potential->'score',
    'confidence', target_confidence->'score',
    'aiRequestIds', target_ai_request_ids,
    'cached', false
  );
  update public.candidate_qualification_batch_members_v2
  set
    status = 'completed',
    output_reference_json = output_reference,
    completed_at = now()
  where id = member.id;
  return output_reference;
end;
$$;

create or replace function public.block_candidate_qualification_member_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_error_code text,
  target_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_qualification_batch_members_v2;
  output_reference jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  select *
  into member
  from public.candidate_qualification_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null then
    raise exception 'Qualification member not found.';
  end if;
  if member.status in ('completed', 'blocked') then
    return member.output_reference_json;
  end if;
  output_reference := jsonb_build_object(
    'schemaVersion', 2,
    'memberId', member.id,
    'campaignCandidateId', member.campaign_candidate_id,
    'evaluationVersionId', member.candidate_evaluation_version_id,
    'status', 'blocked',
    'eligibility', null,
    'lane', null,
    'fitScore', null,
    'potentialScore', null,
    'confidence', null,
    'aiRequestIds', coalesce((
      select jsonb_agg(
        cached_output.ai_request_id
        order by cached_output.ai_request_id
      )
      from public.candidate_qualification_ai_outputs_v2 cached_output
      where cached_output.candidate_qualification_member_id = member.id
    ), '[]'::jsonb),
    'cached', false
  );
  update public.candidate_qualification_batch_members_v2
  set
    status = 'blocked',
    error_code = coalesce(
      nullif(trim(target_error_code), ''),
      'qualification_member_failed'
    ),
    error_message = left(
      coalesce(target_error_message, 'Qualification member failed.'),
      1000
    ),
    output_reference_json = output_reference,
    completed_at = now()
  where id = member.id;
  update public.candidate_evaluation_versions
  set status = 'failed'
  where id = member.candidate_evaluation_version_id
    and status not in ('comparative_pending', 'finalized', 'superseded');
  insert into public.candidate_evaluation_events (
    workspace_id,
    candidate_evaluation_version_id,
    event_type,
    event_payload_json
  ) values (
    target_workspace_id,
    member.candidate_evaluation_version_id,
    'qualification_blocked',
    jsonb_build_object(
      'errorCode', target_error_code,
      'errorMessage', left(coalesce(target_error_message, ''), 1000)
    )
  );
  return output_reference;
end;
$$;

create or replace function public.finalize_candidate_qualification_batch_v2(
  target_workspace_id uuid,
  target_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  qualification_batch public.candidate_qualification_batches_v2;
  settled_completed_count integer;
  settled_blocked_count integer;
  result jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where id = target_batch_id
    and workspace_id = target_workspace_id
  for update;
  if qualification_batch.id is null then
    raise exception 'Qualification batch not found.';
  end if;
  if exists (
    select 1
    from public.candidate_qualification_batch_members_v2 member
    where member.candidate_qualification_batch_id =
      qualification_batch.id
      and member.status not in ('completed', 'blocked')
  ) then
    raise exception 'Qualification batch has unsettled members.';
  end if;
  select
    count(*) filter (where member.status = 'completed')::integer,
    count(*) filter (where member.status = 'blocked')::integer
  into settled_completed_count, settled_blocked_count
  from public.candidate_qualification_batch_members_v2 member
  where member.candidate_qualification_batch_id =
    qualification_batch.id;
  result := jsonb_build_object(
    'schemaVersion', 2,
    'batchId', qualification_batch.id,
    'campaignRunId', qualification_batch.campaign_run_id,
    'status', case
      when settled_blocked_count > 0 then 'partial'
      else 'completed'
    end,
    'candidateCount', qualification_batch.candidate_count,
    'completedCount', settled_completed_count,
    'blockedCount', settled_blocked_count,
    'evaluationVersionIds', coalesce((
      select jsonb_agg(
        member.candidate_evaluation_version_id
        order by member.candidate_evaluation_version_id
      )
      from public.candidate_qualification_batch_members_v2 member
      where member.candidate_qualification_batch_id =
        qualification_batch.id
    ), '[]'::jsonb),
    'aiRequestIds', coalesce((
      select jsonb_agg(
        cached_output.ai_request_id
        order by cached_output.ai_request_id
      )
      from public.candidate_qualification_ai_outputs_v2 cached_output
      join public.candidate_qualification_batch_members_v2 member
        on member.id =
          cached_output.candidate_qualification_member_id
      where member.candidate_qualification_batch_id =
        qualification_batch.id
    ), '[]'::jsonb),
    'laneCounts', coalesce((
      select jsonb_object_agg(lane_count.lane, lane_count.total)
      from (
        select lane_assignment.lane, count(*)::integer as total
        from public.candidate_qualification_batch_members_v2 member
        join public.candidate_review_lane_assignments lane_assignment
          on lane_assignment.candidate_evaluation_version_id =
            member.candidate_evaluation_version_id
        where member.candidate_qualification_batch_id =
          qualification_batch.id
        group by lane_assignment.lane
        order by lane_assignment.lane
      ) lane_count
    ), '{}'::jsonb)
  );
  update public.candidate_qualification_batches_v2
  set
    status = case
      when settled_blocked_count > 0 then 'partial'
      else 'completed'
    end,
    completed_count = settled_completed_count,
    blocked_count = settled_blocked_count,
    output_reference_json = result,
    completed_at = now()
  where id = qualification_batch.id;
  return result;
end;
$$;

revoke all on function public.claim_candidate_qualification_member_v2(
  uuid, uuid, text
) from public, anon, authenticated;
revoke all on function public.save_candidate_qualification_ai_output_v2(
  uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.complete_candidate_qualification_member_v2(
  uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.block_candidate_qualification_member_v2(
  uuid, uuid, text, text
) from public, anon, authenticated;
revoke all on function public.finalize_candidate_qualification_batch_v2(
  uuid, uuid
) from public, anon, authenticated;

grant execute on function public.claim_candidate_qualification_member_v2(
  uuid, uuid, text
) to service_role;
grant execute on function public.save_candidate_qualification_ai_output_v2(
  uuid, uuid, text, text, jsonb, jsonb
) to service_role;
grant execute on function public.complete_candidate_qualification_member_v2(
  uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb,
  jsonb, jsonb, jsonb, text, jsonb, jsonb
) to service_role;
grant execute on function public.block_candidate_qualification_member_v2(
  uuid, uuid, text, text
) to service_role;
grant execute on function public.finalize_candidate_qualification_batch_v2(
  uuid, uuid
) to service_role;
