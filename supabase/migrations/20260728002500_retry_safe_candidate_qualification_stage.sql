-- Retry-safe Qualification V2 runtime, part 1 of 2.
-- Apply after 20260728002400_retry_safe_candidate_research_stage_part_2.sql.

alter table public.candidate_relationship_assessments
  add column counter_evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(counter_evidence_ids_json) = 'array'),
  add column objective_compatibility text not null default 'unknown'
    check (objective_compatibility in (
      'compatible', 'conditionally_compatible', 'incompatible', 'unknown'
    )),
  add column concise_rationale text not null default '',
  add column classifier_version text not null default 'qualification-v2';

alter table public.candidate_exclusion_assessments
  add column counter_evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(counter_evidence_ids_json) = 'array');

alter table public.candidate_factor_evaluations
  add column missing_evidence_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_evidence_json) = 'array'),
  add column evaluator_version text not null default 'qualification-v2';

create table public.candidate_qualification_batches_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  candidate_research_batch_id uuid not null
    references public.candidate_research_batches_v2(id) on delete restrict,
  qualification_rubric_id uuid not null
    references public.qualification_rubrics(id) on delete restrict,
  contract_version text not null check (length(trim(contract_version)) > 0),
  input_hash text not null check (length(input_hash) = 64),
  rubric_json jsonb not null check (jsonb_typeof(rubric_json) = 'object'),
  candidate_count integer not null check (candidate_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  status text not null default 'running' check (
    status in ('running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  output_reference_json jsonb
    check (
      output_reference_json is null
      or jsonb_typeof(output_reference_json) = 'object'
    ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_run_id),
  unique (campaign_run_id, input_hash)
);

create table public.candidate_qualification_batch_members_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_qualification_batch_id uuid not null
    references public.candidate_qualification_batches_v2(id) on delete cascade,
  campaign_candidate_id uuid not null
    references public.campaign_candidates(id) on delete cascade,
  candidate_intelligence_version_id uuid not null
    references public.candidate_intelligence_versions(id) on delete restrict,
  candidate_evaluation_version_id uuid not null
    references public.candidate_evaluation_versions(id) on delete restrict,
  input_hash text not null check (length(input_hash) = 64),
  input_snapshot_json jsonb not null
    check (jsonb_typeof(input_snapshot_json) = 'object'),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'blocked', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  trigger_run_id text,
  output_reference_json jsonb
    check (
      output_reference_json is null
      or jsonb_typeof(output_reference_json) = 'object'
    ),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_qualification_batch_id, campaign_candidate_id),
  unique (candidate_qualification_batch_id, candidate_evaluation_version_id)
);

create table public.candidate_qualification_ai_outputs_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_qualification_member_id uuid not null
    references public.candidate_qualification_batch_members_v2(id)
    on delete cascade,
  task_type text not null check (task_type in ('relationship', 'factors')),
  request_hash text not null check (length(request_hash) = 64),
  output_json jsonb not null check (jsonb_typeof(output_json) = 'object'),
  ai_request_id uuid not null references public.ai_requests(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (candidate_qualification_member_id, task_type, request_hash)
);

create index candidate_qualification_batches_v2_run_idx
on public.candidate_qualification_batches_v2(
  workspace_id, campaign_run_id, status
);

create index candidate_qualification_members_v2_queue_idx
on public.candidate_qualification_batch_members_v2(
  workspace_id, candidate_qualification_batch_id, status, created_at
)
where status in ('queued', 'running');

create or replace function public.validate_candidate_qualification_runtime_workspace_v2()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_campaign_id uuid;
  expected_strategy_id uuid;
  expected_candidate_id uuid;
begin
  if tg_table_name = 'candidate_qualification_batches_v2' then
    select
      campaign_run.workspace_id,
      campaign_run.campaign_id,
      campaign_run.strategy_version_id
    into
      expected_workspace_id,
      expected_campaign_id,
      expected_strategy_id
    from public.campaign_runs campaign_run
    where campaign_run.id = new.campaign_run_id;
    if expected_workspace_id is null
      or expected_workspace_id <> new.workspace_id
      or expected_campaign_id <> new.campaign_id
      or expected_strategy_id <> new.campaign_strategy_version_id
    then
      raise exception 'Qualification batch Campaign Run mismatch.';
    end if;
    if not exists (
      select 1
      from public.candidate_research_batches_v2 research_batch
      where research_batch.id = new.candidate_research_batch_id
        and research_batch.workspace_id = new.workspace_id
        and research_batch.campaign_run_id = new.campaign_run_id
        and research_batch.campaign_strategy_version_id =
          new.campaign_strategy_version_id
    ) then
      raise exception 'Qualification batch Candidate Research mismatch.';
    end if;
    if not exists (
      select 1
      from public.qualification_rubrics rubric
      where rubric.id = new.qualification_rubric_id
        and rubric.workspace_id = new.workspace_id
        and rubric.campaign_strategy_version_id =
          new.campaign_strategy_version_id
    ) then
      raise exception 'Qualification batch rubric mismatch.';
    end if;
  elsif tg_table_name = 'candidate_qualification_batch_members_v2' then
    select
      qualification_batch.workspace_id,
      campaign_candidate.id
    into
      expected_workspace_id,
      expected_candidate_id
    from public.candidate_qualification_batches_v2 qualification_batch
    join public.campaign_candidates campaign_candidate
      on campaign_candidate.id = new.campaign_candidate_id
      and campaign_candidate.workspace_id = qualification_batch.workspace_id
      and campaign_candidate.campaign_id = qualification_batch.campaign_id
      and campaign_candidate.campaign_strategy_version_id =
        qualification_batch.campaign_strategy_version_id
    where qualification_batch.id = new.candidate_qualification_batch_id;
    if expected_workspace_id is null
      or expected_workspace_id <> new.workspace_id
      or expected_candidate_id is null
    then
      raise exception 'Qualification member batch mismatch.';
    end if;
    if not exists (
      select 1
      from public.candidate_intelligence_versions intelligence_version
      join public.campaign_candidates campaign_candidate
        on campaign_candidate.id = new.campaign_candidate_id
        and campaign_candidate.organization_id =
          intelligence_version.organization_id
      where intelligence_version.id =
        new.candidate_intelligence_version_id
        and intelligence_version.workspace_id = new.workspace_id
    ) then
      raise exception 'Qualification member Candidate Intelligence mismatch.';
    end if;
    if not exists (
      select 1
      from public.candidate_evaluation_versions evaluation_version
      where evaluation_version.id =
        new.candidate_evaluation_version_id
        and evaluation_version.workspace_id = new.workspace_id
        and evaluation_version.campaign_candidate_id =
          new.campaign_candidate_id
        and evaluation_version.candidate_intelligence_version_id =
          new.candidate_intelligence_version_id
    ) then
      raise exception 'Qualification member evaluation mismatch.';
    end if;
  else
    select qualification_member.workspace_id
    into expected_workspace_id
    from public.candidate_qualification_batch_members_v2 qualification_member
    where qualification_member.id =
      new.candidate_qualification_member_id;
    if expected_workspace_id is null
      or expected_workspace_id <> new.workspace_id
    then
      raise exception 'Qualification AI output member mismatch.';
    end if;
  end if;
  return new;
end;
$$;

create trigger candidate_qualification_batches_v2_workspace_guard
before insert or update on public.candidate_qualification_batches_v2
for each row execute function
  public.validate_candidate_qualification_runtime_workspace_v2();

create trigger candidate_qualification_members_v2_workspace_guard
before insert or update on public.candidate_qualification_batch_members_v2
for each row execute function
  public.validate_candidate_qualification_runtime_workspace_v2();

create trigger candidate_qualification_ai_outputs_v2_workspace_guard
before insert or update on public.candidate_qualification_ai_outputs_v2
for each row execute function
  public.validate_candidate_qualification_runtime_workspace_v2();

alter table public.candidate_qualification_batches_v2
  enable row level security;
alter table public.candidate_qualification_batch_members_v2
  enable row level security;
alter table public.candidate_qualification_ai_outputs_v2
  enable row level security;

create policy "Members can read candidate qualification batches v2"
on public.candidate_qualification_batches_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members can read candidate qualification members v2"
on public.candidate_qualification_batch_members_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Members can read candidate qualification outputs v2"
on public.candidate_qualification_ai_outputs_v2
for select to authenticated
using (public.is_workspace_member(workspace_id));

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_qualification_runtime_v2;

revoke all on function
  public.clear_workspace_data_before_qualification_runtime_v2(uuid)
from public, anon, authenticated;

create function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  delete from public.candidate_qualification_ai_outputs_v2
  where workspace_id = target_workspace_id;
  delete from public.candidate_qualification_batch_members_v2
  where workspace_id = target_workspace_id;
  delete from public.candidate_qualification_batches_v2
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_qualification_runtime_v2(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid)
from public, anon;
grant execute on function public.clear_workspace_data(uuid)
to authenticated;

create or replace function public.load_campaign_qualification_inputs_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  strategy_version public.campaign_strategy_versions;
  research_batch public.candidate_research_batches_v2;
  result jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
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
  select *
  into strategy_version
  from public.campaign_strategy_versions
  where id = campaign_run.strategy_version_id
    and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and confirmation_status = 'confirmed';
  if strategy_version.id is null then
    raise exception 'Frozen confirmed V2 Strategy not found.';
  end if;
  select *
  into research_batch
  from public.candidate_research_batches_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and status in ('completed', 'partial');
  if research_batch.id is null then
    raise exception 'Qualification requires settled Candidate Research.';
  end if;
  if exists (
    select 1
    from public.candidate_research_batch_members_v2 research_member
    where research_member.candidate_research_batch_id = research_batch.id
      and research_member.status not in ('completed', 'blocked')
  ) then
    raise exception 'Candidate Research members are not settled.';
  end if;

  select jsonb_build_object(
    'schemaVersion', 2,
    'campaignRunId', campaign_run.id,
    'campaignId', campaign_run.campaign_id,
    'strategyVersionId', strategy_version.id,
    'strategy', strategy_version.strategy,
    'researchBatchId', research_batch.id,
    'candidates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'campaignCandidateId', campaign_candidate.id,
          'organizationId', organization.id,
          'candidateIntelligenceVersionId', intelligence_version.id,
          'intelligenceContentHash', intelligence_version.content_hash,
          'state', campaign_candidate.state,
          'identityConfidence', organization.identity_confidence,
          'identityReviewState', organization.identity_review_state,
          'operatingStatus', organization.operating_status,
          'mergedIntoOrganizationId', organization.merged_into_company_id,
          'procurementAutonomy', buying_hypothesis.procurement_autonomy,
          'procurementConfidence', buying_hypothesis.confidence
        )
        order by campaign_candidate.id
      )
      from public.candidate_research_batch_members_v2 research_member
      join public.campaign_candidates campaign_candidate
        on campaign_candidate.id = research_member.campaign_candidate_id
        and campaign_candidate.workspace_id = target_workspace_id
        and campaign_candidate.campaign_id = campaign_run.campaign_id
        and campaign_candidate.campaign_strategy_version_id =
          campaign_run.strategy_version_id
      join public.companies organization
        on organization.id = research_member.organization_id
        and organization.workspace_id = target_workspace_id
      join public.candidate_intelligence_versions intelligence_version
        on intelligence_version.id = research_member.intelligence_version_id
        and intelligence_version.workspace_id = target_workspace_id
        and intelligence_version.organization_id = organization.id
      left join lateral (
        select hypothesis.procurement_autonomy, hypothesis.confidence
        from public.organization_buying_hypotheses hypothesis
        where hypothesis.workspace_id = target_workspace_id
          and hypothesis.target_organization_id = organization.id
          and (
            hypothesis.campaign_id = campaign_run.campaign_id
            or hypothesis.campaign_id is null
          )
          and hypothesis.status in ('confirmed', 'proposed')
        order by
          case when hypothesis.status = 'confirmed' then 0 else 1 end,
          hypothesis.created_at desc
        limit 1
      ) buying_hypothesis on true
      where research_member.candidate_research_batch_id = research_batch.id
        and research_member.status in ('completed', 'blocked')
    ), '[]'::jsonb)
  )
  into result;
  return result;
end;
$$;

create or replace function public.initialize_candidate_qualification_batch_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_contract_version text,
  target_input_hash text,
  target_rubric jsonb,
  target_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  research_batch public.candidate_research_batches_v2;
  saved_rubric public.qualification_rubrics;
  saved_batch public.candidate_qualification_batches_v2;
  saved_member public.candidate_qualification_batch_members_v2;
  campaign_candidate public.campaign_candidates;
  organization public.companies;
  intelligence_version public.candidate_intelligence_versions;
  evaluation_version public.candidate_evaluation_versions;
  candidate_item jsonb;
  candidate_id uuid;
  intelligence_version_id uuid;
  next_version integer;
  expected_count integer;
  member_ids uuid[] := '{}';
  pending_member_ids uuid[] := '{}';
  input_snapshot jsonb;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if length(target_input_hash) <> 64
    or nullif(trim(target_contract_version), '') is null
    or jsonb_typeof(target_rubric) <> 'object'
    or jsonb_typeof(target_rubric->'factors') <> 'array'
    or jsonb_typeof(target_rubric->'thresholds') <> 'object'
    or length(target_rubric->>'contentHash') <> 64
    or jsonb_typeof(target_candidates) <> 'array'
  then
    raise exception 'Invalid Qualification batch input.';
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
  if not exists (
    select 1
    from public.workspace_intelligence_settings settings
    where settings.workspace_id = target_workspace_id
      and settings.campaign_workflow = 'v2'
      and settings.result_write_mode = 'canonical'
      and settings.shadow_mode = false
  ) then
    raise exception 'Canonical Qualification V2 is not enabled.';
  end if;
  select *
  into research_batch
  from public.candidate_research_batches_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and status in ('completed', 'partial');
  if research_batch.id is null then
    raise exception 'Qualification requires settled Candidate Research.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('candidate-qualification:' || campaign_run.id::text, 0)
  );
  select *
  into saved_batch
  from public.candidate_qualification_batches_v2
  where campaign_run_id = campaign_run.id
  for update;
  if saved_batch.id is not null then
    if saved_batch.input_hash <> target_input_hash
      or saved_batch.contract_version <> target_contract_version
      or saved_batch.candidate_research_batch_id <> research_batch.id
      or saved_batch.rubric_json <> target_rubric
    then
      raise exception 'Qualification batch input changed after it was frozen.';
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
        from public.candidate_qualification_batch_members_v2 member
        where member.candidate_qualification_batch_id = saved_batch.id
      ), '[]'::jsonb),
      'pendingMemberIds', coalesce((
        select jsonb_agg(member.id order by member.id)
        from public.candidate_qualification_batch_members_v2 member
        where member.candidate_qualification_batch_id = saved_batch.id
          and member.status in ('queued', 'running')
      ), '[]'::jsonb),
      'reusedMemberCount', (
        select count(*)::integer
        from public.candidate_qualification_batch_members_v2 member
        where member.candidate_qualification_batch_id = saved_batch.id
          and member.status = 'completed'
          and member.attempt_count = 0
      )
    );
  end if;

  select count(*)::integer
  into expected_count
  from public.candidate_research_batch_members_v2 research_member
  where research_member.candidate_research_batch_id = research_batch.id
    and research_member.status in ('completed', 'blocked');
  if jsonb_array_length(target_candidates) <> expected_count then
    raise exception 'Qualification candidate set does not match Candidate Research.';
  end if;
  if (
    select count(distinct item->>'campaignCandidateId')
    from jsonb_array_elements(target_candidates) item
  ) <> expected_count then
    raise exception 'Qualification candidate set contains duplicates.';
  end if;

  insert into public.qualification_rubrics (
    workspace_id,
    campaign_strategy_version_id,
    factor_library_version,
    scoring_policy_version,
    relationship_classifier_version,
    exclusion_policy_version,
    factors_json,
    thresholds_json,
    content_hash
  ) values (
    target_workspace_id,
    campaign_run.strategy_version_id,
    target_rubric->>'factorLibraryVersion',
    target_rubric->>'scoringPolicyVersion',
    target_rubric->>'relationshipClassifierVersion',
    target_rubric->>'exclusionPolicyVersion',
    target_rubric->'factors',
    target_rubric->'thresholds',
    target_rubric->>'contentHash'
  )
  on conflict (campaign_strategy_version_id, content_hash)
  do nothing
  returning * into saved_rubric;
  if saved_rubric.id is null then
    select *
    into saved_rubric
    from public.qualification_rubrics
    where campaign_strategy_version_id = campaign_run.strategy_version_id
      and content_hash = target_rubric->>'contentHash';
  end if;

  insert into public.candidate_qualification_batches_v2 (
    workspace_id,
    campaign_run_id,
    campaign_id,
    campaign_strategy_version_id,
    candidate_research_batch_id,
    qualification_rubric_id,
    contract_version,
    input_hash,
    rubric_json,
    candidate_count,
    status
  ) values (
    target_workspace_id,
    campaign_run.id,
    campaign_run.campaign_id,
    campaign_run.strategy_version_id,
    research_batch.id,
    saved_rubric.id,
    target_contract_version,
    target_input_hash,
    target_rubric,
    expected_count,
    'running'
  )
  returning * into saved_batch;

  for candidate_item in
    select item
    from jsonb_array_elements(target_candidates) item
    order by item->>'campaignCandidateId'
  loop
    candidate_id := (candidate_item->>'campaignCandidateId')::uuid;
    intelligence_version_id :=
      (candidate_item->>'candidateIntelligenceVersionId')::uuid;
    if length(candidate_item->>'inputHash') <> 64 then
      raise exception 'Invalid Qualification member input hash.';
    end if;
    select *
    into campaign_candidate
    from public.campaign_candidates
    where id = candidate_id
      and workspace_id = target_workspace_id
      and campaign_id = campaign_run.campaign_id
      and campaign_strategy_version_id = campaign_run.strategy_version_id;
    select *
    into organization
    from public.companies
    where id = campaign_candidate.organization_id
      and workspace_id = target_workspace_id;
    select *
    into intelligence_version
    from public.candidate_intelligence_versions
    where id = intelligence_version_id
      and workspace_id = target_workspace_id
      and organization_id = campaign_candidate.organization_id;
    if campaign_candidate.id is null
      or organization.id is null
      or intelligence_version.id is null
      or campaign_candidate.current_intelligence_version_id <>
        intelligence_version.id
      or not exists (
        select 1
        from public.candidate_research_batch_members_v2 research_member
        where research_member.candidate_research_batch_id = research_batch.id
          and research_member.campaign_candidate_id = campaign_candidate.id
          and research_member.intelligence_version_id =
            intelligence_version.id
          and research_member.status in ('completed', 'blocked')
      )
    then
      raise exception 'Qualification member references foreign frozen inputs.';
    end if;

    input_snapshot := jsonb_build_object(
      'validEntity', (candidate_item->>'validEntity')::boolean,
      'merged', (candidate_item->>'merged')::boolean,
      'identityConfidence',
        (candidate_item->>'identityConfidence')::numeric,
      'procurementConfidence',
        (candidate_item->>'procurementConfidence')::numeric,
      'procurementAutonomy', candidate_item->'procurementAutonomy',
      'procurementCritical',
        (candidate_item->>'procurementCritical')::boolean,
      'candidateState', campaign_candidate.state,
      'organization', jsonb_build_object(
        'id', organization.id,
        'name', organization.name,
        'organizationType', organization.organization_type,
        'operatingStatus', organization.operating_status,
        'identityConfidence', organization.identity_confidence,
        'identityReviewState', organization.identity_review_state
      )
    );
    perform pg_advisory_xact_lock(
      hashtextextended(
        'candidate-evaluation:' || campaign_candidate.id::text,
        0
      )
    );
    select coalesce(max(version_number), 0) + 1
    into next_version
    from public.candidate_evaluation_versions
    where campaign_candidate_id = campaign_candidate.id;
    insert into public.candidate_evaluation_versions (
      workspace_id,
      campaign_candidate_id,
      campaign_strategy_version_id,
      candidate_intelligence_version_id,
      qualification_rubric_id,
      version_number,
      status,
      compiled_snapshot_json,
      content_hash
    ) values (
      target_workspace_id,
      campaign_candidate.id,
      campaign_run.strategy_version_id,
      intelligence_version.id,
      saved_rubric.id,
      next_version,
      'pending',
      jsonb_build_object(
        'campaignRunId', campaign_run.id,
        'candidateInput', input_snapshot,
        'rubricContentHash', saved_rubric.content_hash,
        'candidateIntelligenceContentHash',
          intelligence_version.content_hash,
        'contractVersion', target_contract_version
      ),
      candidate_item->>'inputHash'
    )
    returning * into evaluation_version;
    insert into public.candidate_qualification_batch_members_v2 (
      workspace_id,
      candidate_qualification_batch_id,
      campaign_candidate_id,
      candidate_intelligence_version_id,
      candidate_evaluation_version_id,
      input_hash,
      input_snapshot_json,
      status
    ) values (
      target_workspace_id,
      saved_batch.id,
      campaign_candidate.id,
      intelligence_version.id,
      evaluation_version.id,
      candidate_item->>'inputHash',
      input_snapshot,
      'queued'
    )
    returning * into saved_member;
    member_ids := array_append(member_ids, saved_member.id);
    pending_member_ids := array_append(pending_member_ids, saved_member.id);
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
    'reusedMemberCount', 0
  );
end;
$$;

revoke all on function public.load_campaign_qualification_inputs_v2(
  uuid, uuid
) from public, anon, authenticated;
revoke all on function public.initialize_candidate_qualification_batch_v2(
  uuid, uuid, text, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.load_campaign_qualification_inputs_v2(
  uuid, uuid
) to service_role;
grant execute on function public.initialize_candidate_qualification_batch_v2(
  uuid, uuid, text, text, jsonb, jsonb
) to service_role;
