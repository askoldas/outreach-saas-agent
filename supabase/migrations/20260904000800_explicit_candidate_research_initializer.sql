-- Explicit final Candidate Research initializer. No catalog-source or textual patching.
create or replace function public.initialize_candidate_research_batch_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_contract_version text,
  target_input_hash text,
  target_plans jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  campaign_run public.campaign_runs;
  research_cycle public.campaign_research_cycles_v2;
  resolution_batch public.entity_resolution_batches_v2;
  saved_batch public.candidate_research_batches_v2;
  saved_member public.candidate_research_batch_members_v2;
  saved_plan public.candidate_research_plans;
  plan_item jsonb;
  expected_candidate_count integer;
  next_plan_version integer;
  reused_count integer := 0;
  member_ids uuid[] := '{}';
  pending_member_ids uuid[] := '{}';
  candidate_id uuid;
  organization_id uuid;
  reusable_version_id uuid;
  output_reference jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if length(target_input_hash) <> 64
    or nullif(trim(target_contract_version), '') is null
    or jsonb_typeof(target_plans) <> 'array'
  then
    raise exception 'Invalid Candidate Research batch input.';
  end if;
  select *
  into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2';
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;
  select * into research_cycle
  from public.campaign_research_cycles_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
  order by cycle_number desc limit 1;
  if research_cycle.id is null then
    raise exception 'Candidate Research requires a Campaign Research cycle.';
  end if;
  if not exists (
    select 1
    from public.workspace_intelligence_settings settings
    where settings.workspace_id = target_workspace_id
      and settings.campaign_workflow = 'v2'
      and settings.result_write_mode = 'canonical'
      and settings.shadow_mode = false
  ) then
    raise exception 'Canonical Candidate Research is not enabled.';
  end if;
  select *
  into resolution_batch
  from public.entity_resolution_batches_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and status = 'completed';
  if resolution_batch.id is null then
    raise exception 'Candidate Research requires completed Entity Resolution.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('candidate-research:' || campaign_run.id::text, 0)
  );
  select *
  into saved_batch
  from public.candidate_research_batches_v2
  where campaign_run_id = campaign_run.id
    and research_cycle_id = research_cycle.id
  for update;
  if saved_batch.id is not null then
    if saved_batch.input_hash <> target_input_hash
      or saved_batch.contract_version <> target_contract_version
      or saved_batch.entity_resolution_batch_id <> resolution_batch.id
    then
      raise exception 'Candidate Research batch input changed after it was frozen.';
    end if;
    return jsonb_build_object(
      'schemaVersion', 2,
      'batchId', saved_batch.id,
      'campaignRunId', saved_batch.campaign_run_id,
      'contractVersion', saved_batch.contract_version,
      'inputHash', saved_batch.input_hash,
      'status', saved_batch.status,
      'candidateCount', saved_batch.candidate_count,
      'memberIds', coalesce((
        select jsonb_agg(member.id order by member.id)
        from public.candidate_research_batch_members_v2 member
        where member.candidate_research_batch_id = saved_batch.id
      ), '[]'::jsonb),
      'pendingMemberIds', coalesce((
        select jsonb_agg(member.id order by member.id)
        from public.candidate_research_batch_members_v2 member
        where member.candidate_research_batch_id = saved_batch.id
          and member.status in ('queued', 'running')
      ), '[]'::jsonb),
      'reusedMemberCount', (
        select count(*)::integer
        from public.candidate_research_batch_members_v2 member
        where member.candidate_research_batch_id = saved_batch.id
          and member.status = 'completed'
          and member.attempt_count = 0
      )
    );
  end if;

  select count(distinct campaign_candidate.id)::integer
  into expected_candidate_count
  from public.campaign_candidate_discovery_links discovery_link
  join public.entity_resolution_cases resolution_case
    on resolution_case.normalized_candidate_id =
      discovery_link.normalized_candidate_id
    and resolution_case.entity_resolution_batch_id = resolution_batch.id
  join public.entity_resolution_decisions resolution_decision
    on resolution_decision.resolution_case_id = resolution_case.id
    and resolution_decision.action in ('link_existing', 'create_new')
    and resolution_decision.target_organization_id is not null
  join public.campaign_candidates campaign_candidate
    on campaign_candidate.id = discovery_link.campaign_candidate_id
    and campaign_candidate.organization_id =
      resolution_decision.target_organization_id
    and campaign_candidate.campaign_id = campaign_run.campaign_id
    and campaign_candidate.campaign_strategy_version_id =
      campaign_run.strategy_version_id
  where discovery_link.workspace_id = target_workspace_id;
  if jsonb_array_length(target_plans) > expected_candidate_count then
    raise exception 'Candidate Research plan subset exceeds the resolved pool.';
  end if;
  if (
    select count(distinct item->>'campaignCandidateId')
    from jsonb_array_elements(target_plans) item
  ) <> jsonb_array_length(target_plans) then
    raise exception 'Candidate Research plan set contains duplicate candidates.';
  end if;

  insert into public.candidate_research_batches_v2 (
    workspace_id,
    campaign_run_id,
    research_cycle_id,
    campaign_id,
    campaign_strategy_version_id,
    entity_resolution_batch_id,
    contract_version,
    input_hash,
    candidate_count,
    status
  ) values (
    target_workspace_id,
    campaign_run.id,
    research_cycle.id,
    campaign_run.campaign_id,
    campaign_run.strategy_version_id,
    resolution_batch.id,
    target_contract_version,
    target_input_hash,
    expected_candidate_count,
    'running'
  )
  returning * into saved_batch;

  for plan_item in
    select item
    from jsonb_array_elements(target_plans) item
    order by item->>'campaignCandidateId'
  loop
    candidate_id := (plan_item->>'campaignCandidateId')::uuid;
    organization_id := (plan_item->>'organizationId')::uuid;
    reusable_version_id :=
      nullif(plan_item->>'reusableIntelligenceVersionId', '')::uuid;
    if length(plan_item->>'inputHash') <> 64
      or length(plan_item->>'contentHash') <> 64
      or jsonb_typeof(plan_item->'plan') <> 'object'
      or jsonb_typeof(plan_item->'sourcePlan') <> 'object'
      or jsonb_typeof(plan_item #> '{plan,questions}') <> 'array'
      or jsonb_array_length(plan_item #> '{plan,questions}') > 12
    then
      raise exception 'Invalid Candidate Research plan payload.';
    end if;
    if not exists (
      select 1
      from public.campaign_candidate_discovery_links discovery_link
      join public.entity_resolution_cases resolution_case
        on resolution_case.normalized_candidate_id =
          discovery_link.normalized_candidate_id
        and resolution_case.entity_resolution_batch_id = resolution_batch.id
      join public.entity_resolution_decisions resolution_decision
        on resolution_decision.resolution_case_id = resolution_case.id
        and resolution_decision.action in ('link_existing', 'create_new')
        and resolution_decision.target_organization_id = organization_id
      join public.campaign_candidates campaign_candidate
        on campaign_candidate.id = discovery_link.campaign_candidate_id
        and campaign_candidate.id = candidate_id
        and campaign_candidate.organization_id = organization_id
        and campaign_candidate.campaign_id = campaign_run.campaign_id
        and campaign_candidate.campaign_strategy_version_id =
          campaign_run.strategy_version_id
      where discovery_link.workspace_id = target_workspace_id
    ) then
      raise exception 'Candidate Research plan references a foreign candidate.';
    end if;
    if plan_item #>> '{plan,organizationId}' <> organization_id::text
      or plan_item #>> '{plan,campaignCandidateId}' <> candidate_id::text
      or plan_item #>> '{plan,strategyVersionId}' <>
        campaign_run.strategy_version_id::text
    then
      raise exception 'Candidate Research plan subject mismatch.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(
        plan_item #> '{sourcePlan,discoverySourceIds}'
      ) source_id(value)
      where not exists (
        select 1
        from public.campaign_candidate_discovery_links discovery_link
        join public.entity_resolution_cases resolution_case
          on resolution_case.normalized_candidate_id =
            discovery_link.normalized_candidate_id
          and resolution_case.entity_resolution_batch_id =
            resolution_batch.id
        where discovery_link.campaign_candidate_id = candidate_id
          and discovery_link.provider_source_record_id =
            source_id.value::uuid
      )
    ) then
      raise exception 'Candidate Research plan contains foreign Discovery sources.';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended('candidate-research-plan:' || candidate_id::text, 0)
    );
    select coalesce(max(research_plan.version_number), 0) + 1
    into next_plan_version
    from public.candidate_research_plans research_plan
    where research_plan.campaign_candidate_id = candidate_id;
    insert into public.candidate_research_plans (
      workspace_id,
      organization_id,
      campaign_candidate_id,
      campaign_strategy_version_id,
      research_type,
      version_number,
      questions_json,
      source_plan_json,
      stop_policy_json,
      priority,
      page_budget,
      status,
      content_hash
    ) values (
      target_workspace_id,
      organization_id,
      candidate_id,
      campaign_run.strategy_version_id,
      plan_item #>> '{plan,researchType}',
      next_plan_version,
      plan_item #> '{plan,questions}',
      plan_item->'sourcePlan',
      plan_item #> '{plan,stopPolicy}',
      greatest(1, least(100, (plan_item->>'priority')::integer)),
      (plan_item #>> '{plan,pageBudget}')::integer,
      'ready',
      plan_item->>'contentHash'
    )
    returning * into saved_plan;

    output_reference := null;
    if reusable_version_id is not null then
      if jsonb_array_length(saved_plan.questions_json) <> 0
        or not exists (
          select 1
          from public.candidate_intelligence_versions intelligence_version
          where intelligence_version.id = reusable_version_id
            and intelligence_version.workspace_id = target_workspace_id
            and intelligence_version.organization_id = organization_id
        )
      then
        raise exception 'Candidate Research reuse reference is invalid.';
      end if;
      output_reference := jsonb_build_object(
        'schemaVersion', 2,
        'memberId', null,
        'campaignCandidateId', candidate_id,
        'status', 'completed',
        'intelligenceVersionId', reusable_version_id,
        'claimCount', (
          select jsonb_array_length(intelligence_version.claim_ids_json)
          from public.candidate_intelligence_versions intelligence_version
          where intelligence_version.id = reusable_version_id
        ),
        'evidenceCount', (
          select jsonb_array_length(intelligence_version.evidence_ids_json)
          from public.candidate_intelligence_versions intelligence_version
          where intelligence_version.id = reusable_version_id
        ),
        'unresolvedQuestionCount', (
          select jsonb_array_length(
            intelligence_version.unresolved_question_keys_json
          )
          from public.candidate_intelligence_versions intelligence_version
          where intelligence_version.id = reusable_version_id
        ),
        'aiRequestIds', '[]'::jsonb,
        'cached', true
      );
    end if;
    insert into public.candidate_research_batch_members_v2 (
      workspace_id,
      candidate_research_batch_id,
      campaign_candidate_id,
      organization_id,
      research_plan_id,
      input_hash,
      status,
      intelligence_version_id,
      output_reference_json,
      completed_at
    ) values (
      target_workspace_id,
      saved_batch.id,
      candidate_id,
      organization_id,
      saved_plan.id,
      plan_item->>'inputHash',
      case when reusable_version_id is null then 'queued' else 'completed' end,
      reusable_version_id,
      output_reference,
      case when reusable_version_id is null then null else now() end
    )
    returning * into saved_member;
    if reusable_version_id is not null then
      output_reference := jsonb_set(
        output_reference,
        '{memberId}',
        to_jsonb(saved_member.id)
      );
      update public.candidate_research_batch_members_v2
      set output_reference_json = output_reference
      where id = saved_member.id;
      update public.campaign_candidates
      set
        current_intelligence_version_id = reusable_version_id,
        state = 'ready_for_evaluation',
        updated_at = now()
      where id = candidate_id;
      update public.candidate_research_plans
      set status = 'completed'
      where id = saved_plan.id;
      reused_count := reused_count + 1;
    else
      update public.campaign_candidates
      set state = 'research_planned', updated_at = now()
      where id = candidate_id
        and state in ('discovered', 'research_planned');
      pending_member_ids := array_append(pending_member_ids, saved_member.id);
    end if;
    member_ids := array_append(member_ids, saved_member.id);
  end loop;

  return jsonb_build_object(
    'schemaVersion', 2,
    'batchId', saved_batch.id,
    'campaignRunId', saved_batch.campaign_run_id,
    'contractVersion', saved_batch.contract_version,
    'inputHash', saved_batch.input_hash,
    'status', saved_batch.status,
    'candidateCount', saved_batch.candidate_count,
    'memberIds', to_jsonb(member_ids),
    'pendingMemberIds', to_jsonb(pending_member_ids),
    'reusedMemberCount', reused_count
  );
end;
$$;

revoke all on function public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb) to service_role;
