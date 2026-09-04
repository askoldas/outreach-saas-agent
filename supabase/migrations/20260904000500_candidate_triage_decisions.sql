-- Durable, queryable pre-research decisions for every resolved Campaign Candidate.

create table if not exists public.candidate_triage_decisions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  research_cycle_id uuid not null references public.campaign_research_cycles_v2(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete restrict,
  decision text not null check (decision in ('deep_research', 'hold', 'suppress')),
  commercial_opportunity_score numeric(6,3) not null
    check (commercial_opportunity_score between 0 and 100),
  components_json jsonb not null check (jsonb_typeof(components_json) = 'array'),
  suppression_reasons_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(suppression_reasons_json) = 'array'),
  relationship_status text,
  research_difficulty text not null check (research_difficulty in ('low', 'medium', 'high')),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  policy_version text not null check (length(trim(policy_version)) > 0),
  input_hash text not null check (length(input_hash) = 64),
  created_at timestamptz not null default now(),
  unique (research_cycle_id, campaign_candidate_id),
  unique (workspace_id, id)
);

create index if not exists candidate_triage_decisions_v2_campaign_idx
  on public.candidate_triage_decisions_v2(
    workspace_id, campaign_id, campaign_run_id, decision
  );

alter table public.candidate_triage_decisions_v2 enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'candidate_triage_decisions_v2'
      and policyname = 'candidate_triage_decisions_v2_select'
  ) then
    create policy candidate_triage_decisions_v2_select
      on public.candidate_triage_decisions_v2 for select to authenticated
      using (public.is_workspace_member(workspace_id));
  end if;
end;
$$;

revoke insert, update, delete on public.candidate_triage_decisions_v2
from authenticated;

create or replace function public.persist_candidate_triage_decisions_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_cycle_number integer,
  target_decisions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_run public.campaign_runs;
  target_cycle public.campaign_research_cycles_v2;
  resolution_batch public.entity_resolution_batches_v2;
  decision_item jsonb;
  saved_decision public.candidate_triage_decisions_v2;
  expected_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if target_cycle_number < 1 or jsonb_typeof(target_decisions) <> 'array' then
    raise exception 'Invalid Candidate triage input.';
  end if;

  select * into target_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2';
  if target_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into target_cycle
  from public.campaign_research_cycles_v2
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
    and cycle_number = target_cycle_number;
  if target_cycle.id is null then
    raise exception 'Campaign Research cycle not found.';
  end if;

  select * into resolution_batch
  from public.entity_resolution_batches_v2
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
    and status = 'completed';
  if resolution_batch.id is null then
    raise exception 'Candidate triage requires completed Entity Resolution.';
  end if;

  select count(distinct candidate.id)::integer into expected_count
  from public.campaign_candidate_discovery_links discovery_link
  join public.entity_resolution_cases resolution_case
    on resolution_case.normalized_candidate_id = discovery_link.normalized_candidate_id
    and resolution_case.entity_resolution_batch_id = resolution_batch.id
  join public.entity_resolution_decisions resolution_decision
    on resolution_decision.resolution_case_id = resolution_case.id
    and resolution_decision.action in ('link_existing', 'create_new')
    and resolution_decision.target_organization_id is not null
  join public.campaign_candidates candidate
    on candidate.id = discovery_link.campaign_candidate_id
    and candidate.organization_id = resolution_decision.target_organization_id
    and candidate.campaign_id = target_run.campaign_id
    and candidate.campaign_strategy_version_id = target_run.strategy_version_id
  where discovery_link.workspace_id = target_workspace_id;

  if jsonb_array_length(target_decisions) <> expected_count
    or (
      select count(distinct item->>'campaignCandidateId')
      from jsonb_array_elements(target_decisions) item
    ) <> expected_count
  then
    raise exception 'Candidate triage decisions do not cover the Campaign Candidate pool.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('candidate-triage:' || target_cycle.id::text, 0)
  );

  for decision_item in
    select item from jsonb_array_elements(target_decisions) item
    order by item->>'campaignCandidateId'
  loop
    if (decision_item->>'decision') not in ('deep_research', 'hold', 'suppress')
      or (decision_item->>'researchDifficulty') not in ('low', 'medium', 'high')
      or length(decision_item->>'inputHash') <> 64
      or nullif(trim(decision_item->>'policyVersion'), '') is null
      or jsonb_typeof(decision_item->'components') <> 'array'
      or jsonb_typeof(decision_item->'suppressionReasons') <> 'array'
      or jsonb_typeof(decision_item->'evidenceIds') <> 'array'
    then
      raise exception 'Invalid Candidate triage decision payload.';
    end if;
    if not exists (
      select 1
      from public.campaign_candidates candidate
      where candidate.id = (decision_item->>'campaignCandidateId')::uuid
        and candidate.workspace_id = target_workspace_id
        and candidate.campaign_id = target_run.campaign_id
        and candidate.organization_id = (decision_item->>'organizationId')::uuid
        and candidate.campaign_strategy_version_id = target_run.strategy_version_id
    ) then
      raise exception 'Candidate triage decision is outside the frozen Campaign pool.';
    end if;

    insert into public.candidate_triage_decisions_v2 (
      workspace_id, campaign_id, campaign_run_id, research_cycle_id,
      campaign_candidate_id, organization_id, decision,
      commercial_opportunity_score, components_json, suppression_reasons_json,
      relationship_status, research_difficulty, evidence_ids_json,
      policy_version, input_hash
    ) values (
      target_workspace_id, target_run.campaign_id, target_run.id, target_cycle.id,
      (decision_item->>'campaignCandidateId')::uuid,
      (decision_item->>'organizationId')::uuid,
      decision_item->>'decision',
      (decision_item->>'commercialOpportunityScore')::numeric,
      decision_item->'components', decision_item->'suppressionReasons',
      nullif(decision_item->>'relationshipStatus', ''),
      decision_item->>'researchDifficulty',
      (select coalesce(jsonb_agg(distinct value order by value), '[]'::jsonb)
       from jsonb_array_elements_text(decision_item->'evidenceIds') value),
      decision_item->>'policyVersion', decision_item->>'inputHash'
    )
    on conflict (research_cycle_id, campaign_candidate_id) do nothing;

    select * into saved_decision
    from public.candidate_triage_decisions_v2 decision
    where decision.research_cycle_id = target_cycle.id
      and decision.campaign_candidate_id =
        (decision_item->>'campaignCandidateId')::uuid;
    if saved_decision.input_hash <> decision_item->>'inputHash' then
      raise exception 'Candidate triage input changed after it was frozen.';
    end if;
  end loop;

  return jsonb_build_object(
    'schemaVersion', 1,
    'researchCycleId', target_cycle.id,
    'candidateCount', expected_count,
    'deepResearchCount', count(*) filter (where decision = 'deep_research'),
    'holdCount', count(*) filter (where decision = 'hold'),
    'suppressCount', count(*) filter (where decision = 'suppress')
  )
  from public.candidate_triage_decisions_v2
  where research_cycle_id = target_cycle.id;
end;
$$;

revoke all on function public.persist_candidate_triage_decisions_v2(uuid, uuid, integer, jsonb)
from public, anon, authenticated;
grant execute on function public.persist_candidate_triage_decisions_v2(uuid, uuid, integer, jsonb)
to service_role;

-- A fully held/suppressed pool is a valid bounded outcome and must still freeze an
-- empty Candidate Research batch so the durable stage can finalize normally.
do $$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef(
    'public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  ) into function_definition;
  if function_definition is null then
    raise exception 'Candidate Research batch initializer was not found.';
  end if;
  if position('plan subset exceeds the resolved pool' in function_definition) > 0 then
    return;
  end if;
  revised_definition := replace(
    function_definition,
    $old$if jsonb_array_length(target_plans) > expected_candidate_count
    or (expected_candidate_count > 0 and jsonb_array_length(target_plans) = 0)
  then
    raise exception 'Candidate Research plan subset exceeds or omits the resolved pool.';
  end if;$old$,
    $new$if jsonb_array_length(target_plans) > expected_candidate_count then
    raise exception 'Candidate Research plan subset exceeds the resolved pool.';
  end if;$new$
  );
  if revised_definition = function_definition
    or position('plan subset exceeds the resolved pool' in revised_definition) = 0
  then
    raise exception 'Candidate Research initializer did not match the bounded prior contract.';
  end if;
  execute revised_definition;
end;
$$;
