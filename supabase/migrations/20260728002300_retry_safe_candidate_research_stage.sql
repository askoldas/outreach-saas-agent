-- Retry-safe, question-driven Candidate Research for the V2 Campaign workflow,
-- part 1 of 2.
-- Apply after 20260728002200_retry_safe_entity_resolution_stage.sql.

alter table public.evidence_items
  add column discovery_provider_execution_id uuid
    references public.discovery_provider_executions(id) on delete restrict,
  add column candidate_page_fetch_id uuid
    references public.candidate_page_fetches(id) on delete restrict;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select constraint_record.conname
    from pg_constraint constraint_record
    where constraint_record.conrelid = 'public.evidence_items'::regclass
      and constraint_record.contype = 'c'
      and pg_get_constraintdef(constraint_record.oid) ilike '%num_nonnulls%'
      and pg_get_constraintdef(constraint_record.oid) ilike '%company_source_id%'
  loop
    execute format(
      'alter table public.evidence_items drop constraint %I',
      constraint_name
    );
  end loop;
end;
$$;

alter table public.evidence_items
  add constraint evidence_items_exactly_one_source_v2_check
  check (
    num_nonnulls(
      company_source_id,
      document_chunk_id,
      provider_execution_id,
      manual_source_label,
      discovery_provider_execution_id,
      candidate_page_fetch_id
    ) = 1
  );

create index evidence_items_discovery_provider_execution_idx
on public.evidence_items(discovery_provider_execution_id)
where discovery_provider_execution_id is not null;

create index evidence_items_candidate_page_fetch_idx
on public.evidence_items(candidate_page_fetch_id)
where candidate_page_fetch_id is not null;

create or replace function public.validate_evidence_source_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.company_source_id is not null and not exists (
    select 1
    from public.company_sources
    where id = new.company_source_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Company source must belong to the evidence workspace.';
  end if;
  if new.document_chunk_id is not null and not exists (
    select 1
    from public.document_chunks
    where id = new.document_chunk_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Document chunk must belong to the evidence workspace.';
  end if;
  if new.provider_execution_id is not null and not exists (
    select 1
    from public.provider_executions
    where id = new.provider_execution_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Provider execution must belong to the evidence workspace.';
  end if;
  if new.discovery_provider_execution_id is not null and not exists (
    select 1
    from public.discovery_provider_executions
    where id = new.discovery_provider_execution_id
      and workspace_id = new.workspace_id
  ) then
    raise exception 'Discovery provider execution must belong to the evidence workspace.';
  end if;
  if new.candidate_page_fetch_id is not null and not exists (
    select 1
    from public.candidate_page_fetches
    where id = new.candidate_page_fetch_id
      and workspace_id = new.workspace_id
      and organization_id = new.subject_id
  ) then
    raise exception 'Candidate page fetch must belong to the evidence subject.';
  end if;
  return new;
end;
$$;

create table public.candidate_research_batches_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  entity_resolution_batch_id uuid not null
    references public.entity_resolution_batches_v2(id) on delete restrict,
  contract_version text not null check (length(trim(contract_version)) > 0),
  input_hash text not null check (length(input_hash) = 64),
  status text not null default 'running' check (
    status in ('running', 'completed', 'partial', 'failed')
  ),
  candidate_count integer not null check (candidate_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  summary_json jsonb check (
    summary_json is null or jsonb_typeof(summary_json) = 'object'
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_run_id),
  unique (workspace_id, id)
);

create table public.candidate_research_batch_members_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_research_batch_id uuid not null
    references public.candidate_research_batches_v2(id) on delete cascade,
  campaign_candidate_id uuid not null
    references public.campaign_candidates(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete restrict,
  research_plan_id uuid not null
    references public.candidate_research_plans(id) on delete restrict,
  input_hash text not null check (length(input_hash) = 64),
  status text not null default 'queued' check (
    status in ('queued', 'running', 'completed', 'blocked')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  trigger_run_id text,
  extraction_request_hash text check (
    extraction_request_hash is null or length(extraction_request_hash) = 64
  ),
  intelligence_version_id uuid
    references public.candidate_intelligence_versions(id) on delete restrict,
  error_code text,
  output_reference_json jsonb check (
    output_reference_json is null
    or jsonb_typeof(output_reference_json) = 'object'
  ),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (candidate_research_batch_id, campaign_candidate_id),
  unique (candidate_research_batch_id, research_plan_id),
  unique (workspace_id, id)
);

create table public.candidate_research_source_artifacts_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  provider_source_record_id uuid
    references public.provider_source_records(id) on delete restrict,
  candidate_page_fetch_id uuid
    references public.candidate_page_fetches(id) on delete restrict,
  source_url text not null check (length(trim(source_url)) > 0),
  page_kind text not null check (page_kind in (
    'home', 'about', 'products_services', 'brands_partners', 'locations',
    'legal', 'supplier_procurement', 'careers', 'investor_relations',
    'news', 'contact', 'wholesale_b2b', 'other'
  )),
  content_text text not null check (
    length(content_text) between 1 and 100000
  ),
  content_hash text not null check (length(content_hash) = 64),
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(provider_source_record_id, candidate_page_fetch_id) = 1)
);

create unique index candidate_research_artifact_provider_source_idx
on public.candidate_research_source_artifacts_v2(
  organization_id, provider_source_record_id
)
where provider_source_record_id is not null;

create unique index candidate_research_artifact_page_fetch_idx
on public.candidate_research_source_artifacts_v2(
  organization_id, candidate_page_fetch_id
)
where candidate_page_fetch_id is not null;

create table public.candidate_research_member_sources_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_research_member_id uuid not null
    references public.candidate_research_batch_members_v2(id) on delete cascade,
  source_artifact_id uuid not null
    references public.candidate_research_source_artifacts_v2(id) on delete restrict,
  evidence_id uuid not null
    references public.evidence_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (candidate_research_member_id, source_artifact_id),
  unique (candidate_research_member_id, evidence_id)
);

create index candidate_research_batches_v2_run_idx
on public.candidate_research_batches_v2(
  workspace_id, campaign_run_id, status
);

create index candidate_research_members_v2_queue_idx
on public.candidate_research_batch_members_v2(
  workspace_id, candidate_research_batch_id, status, created_at
)
where status in ('queued', 'running');

create index candidate_research_member_sources_v2_member_idx
on public.candidate_research_member_sources_v2(
  workspace_id, candidate_research_member_id
);

create or replace function public.validate_candidate_research_runtime_workspace_v2()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_campaign_id uuid;
  expected_strategy_version_id uuid;
  expected_organization_id uuid;
begin
  if tg_table_name = 'candidate_research_batches_v2' then
    select campaign_run.workspace_id, campaign_run.campaign_id,
      campaign_run.strategy_version_id
    into expected_workspace_id, expected_campaign_id, expected_strategy_version_id
    from public.campaign_runs campaign_run
    where campaign_run.id = new.campaign_run_id
      and campaign_run.workflow_version = 'v2';
    if expected_campaign_id is distinct from new.campaign_id
      or expected_strategy_version_id is distinct from
        new.campaign_strategy_version_id
      or not exists (
        select 1
        from public.entity_resolution_batches_v2 resolution_batch
        where resolution_batch.id = new.entity_resolution_batch_id
          and resolution_batch.workspace_id = expected_workspace_id
          and resolution_batch.campaign_run_id = new.campaign_run_id
          and resolution_batch.status = 'completed'
      )
    then
      raise exception 'Candidate Research batch context mismatch.';
    end if;
  elsif tg_table_name = 'candidate_research_batch_members_v2' then
    select research_batch.workspace_id, research_batch.campaign_id,
      research_batch.campaign_strategy_version_id
    into expected_workspace_id, expected_campaign_id, expected_strategy_version_id
    from public.candidate_research_batches_v2 research_batch
    where research_batch.id = new.candidate_research_batch_id;
    if not exists (
      select 1
      from public.campaign_candidates campaign_candidate
      where campaign_candidate.id = new.campaign_candidate_id
        and campaign_candidate.workspace_id = expected_workspace_id
        and campaign_candidate.campaign_id = expected_campaign_id
        and campaign_candidate.campaign_strategy_version_id =
          expected_strategy_version_id
        and campaign_candidate.organization_id = new.organization_id
    ) or not exists (
      select 1
      from public.candidate_research_plans research_plan
      where research_plan.id = new.research_plan_id
        and research_plan.workspace_id = expected_workspace_id
        and research_plan.campaign_candidate_id = new.campaign_candidate_id
        and research_plan.organization_id = new.organization_id
        and research_plan.campaign_strategy_version_id =
          expected_strategy_version_id
    ) then
      raise exception 'Candidate Research member context mismatch.';
    end if;
    if new.intelligence_version_id is not null and not exists (
      select 1
      from public.candidate_intelligence_versions intelligence_version
      where intelligence_version.id = new.intelligence_version_id
        and intelligence_version.workspace_id = expected_workspace_id
        and intelligence_version.organization_id = new.organization_id
    ) then
      raise exception 'Candidate Research member Intelligence mismatch.';
    end if;
  elsif tg_table_name = 'candidate_research_source_artifacts_v2' then
    select organization.workspace_id
    into expected_workspace_id
    from public.companies organization
    where organization.id = new.organization_id;
    if new.provider_source_record_id is not null and not exists (
      select 1
      from public.organization_source_links source_link
      where source_link.workspace_id = expected_workspace_id
        and source_link.organization_id = new.organization_id
        and source_link.provider_source_record_id =
          new.provider_source_record_id
        and source_link.link_status = 'active'
    ) then
      raise exception 'Candidate Research provider source is not canonically linked.';
    end if;
    if new.candidate_page_fetch_id is not null and not exists (
      select 1
      from public.candidate_page_fetches page_fetch
      where page_fetch.id = new.candidate_page_fetch_id
        and page_fetch.workspace_id = expected_workspace_id
        and page_fetch.organization_id = new.organization_id
    ) then
      raise exception 'Candidate Research page fetch subject mismatch.';
    end if;
  elsif tg_table_name = 'candidate_research_member_sources_v2' then
    select member.workspace_id, member.organization_id
    into expected_workspace_id, expected_organization_id
    from public.candidate_research_batch_members_v2 member
    where member.id = new.candidate_research_member_id;
    if not exists (
      select 1
      from public.candidate_research_source_artifacts_v2 artifact
      where artifact.id = new.source_artifact_id
        and artifact.workspace_id = expected_workspace_id
        and artifact.organization_id = expected_organization_id
    ) or not exists (
      select 1
      from public.evidence_items evidence
      where evidence.id = new.evidence_id
        and evidence.workspace_id = expected_workspace_id
        and evidence.subject_type = 'organization'
        and evidence.subject_id = expected_organization_id
    ) then
      raise exception 'Candidate Research member source mismatch.';
    end if;
  else
    raise exception 'Unsupported Candidate Research runtime guard.';
  end if;
  if expected_workspace_id is null
    or expected_workspace_id <> new.workspace_id
  then
    raise exception 'Candidate Research runtime workspace mismatch.';
  end if;
  return new;
end;
$$;

create trigger candidate_research_batches_v2_workspace_guard
before insert or update on public.candidate_research_batches_v2
for each row
execute function public.validate_candidate_research_runtime_workspace_v2();

create trigger candidate_research_members_v2_workspace_guard
before insert or update on public.candidate_research_batch_members_v2
for each row
execute function public.validate_candidate_research_runtime_workspace_v2();

create trigger candidate_research_artifacts_v2_workspace_guard
before insert on public.candidate_research_source_artifacts_v2
for each row
execute function public.validate_candidate_research_runtime_workspace_v2();

create trigger candidate_research_member_sources_v2_workspace_guard
before insert on public.candidate_research_member_sources_v2
for each row
execute function public.validate_candidate_research_runtime_workspace_v2();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'candidate_research_batches_v2',
    'candidate_research_batch_members_v2',
    'candidate_research_source_artifacts_v2',
    'candidate_research_member_sources_v2'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name,
      table_name
    );
    execute format(
      'revoke insert, update, delete on public.%I from authenticated',
      table_name
    );
  end loop;
end;
$$;

-- Evidence and claims remain immutable during normal operation. The Settings cleanup
-- RPC receives a transaction-local workspace scope so it can remove one tenant's graph
-- without disabling the mutation guards globally.
create or replace function public.prevent_evidence_claim_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.workspace_cleanup_id', true) = old.workspace_id::text
  then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception
    'Evidence and claims are immutable; append or supersede records instead.';
end;
$$;

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_candidate_research_v2;

revoke all on function
  public.clear_workspace_data_before_candidate_research_v2(uuid)
from public, anon, authenticated;

create function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  perform set_config(
    'app.workspace_cleanup_id',
    target_workspace_id::text,
    true
  );
  -- Durable V2 orchestration.
  delete from public.intelligence_task_attempts
  where workspace_id = target_workspace_id;
  delete from public.workflow_checkpoints
  where workspace_id = target_workspace_id;
  delete from public.workflow_commands
  where workspace_id = target_workspace_id;
  delete from public.workflow_outbox
  where workspace_id = target_workspace_id;
  delete from public.intelligence_usage_events
  where workspace_id = target_workspace_id;
  delete from public.intelligence_task_runs
  where workspace_id = target_workspace_id;
  delete from public.intelligence_workflow_runs
  where workspace_id = target_workspace_id;

  -- Comparative ranking and deterministic qualification.
  delete from public.candidate_rank_entries
  where workspace_id = target_workspace_id;
  delete from public.candidate_rank_snapshots
  where workspace_id = target_workspace_id;
  delete from public.comparative_anomalies
  where workspace_id = target_workspace_id;
  delete from public.comparative_batch_members
  where workspace_id = target_workspace_id;
  delete from public.comparative_batches
  where workspace_id = target_workspace_id;
  delete from public.candidate_explanations
  where workspace_id = target_workspace_id;
  delete from public.candidate_evaluation_events
  where workspace_id = target_workspace_id;
  delete from public.candidate_review_lane_assignments
  where workspace_id = target_workspace_id;
  delete from public.candidate_eligibility_decisions
  where workspace_id = target_workspace_id;
  delete from public.candidate_confidence_calculations
  where workspace_id = target_workspace_id;
  delete from public.candidate_score_calculations
  where workspace_id = target_workspace_id;
  delete from public.candidate_factor_evaluations
  where workspace_id = target_workspace_id;
  delete from public.candidate_exclusion_assessments
  where workspace_id = target_workspace_id;
  delete from public.candidate_relationship_assessments
  where workspace_id = target_workspace_id;
  delete from public.candidate_evaluation_versions
  where workspace_id = target_workspace_id;
  delete from public.qualification_rubrics
  where workspace_id = target_workspace_id;

  -- Candidate research and campaign projections.
  delete from public.candidate_research_member_sources_v2
  where workspace_id = target_workspace_id;
  delete from public.candidate_research_tasks
  where workspace_id = target_workspace_id;
  delete from public.candidate_research_batch_members_v2
  where workspace_id = target_workspace_id;
  delete from public.candidate_research_batches_v2
  where workspace_id = target_workspace_id;
  delete from public.candidate_research_source_artifacts_v2
  where workspace_id = target_workspace_id;
  delete from public.campaign_candidate_claims
  where workspace_id = target_workspace_id;
  delete from public.campaign_candidate_discovery_links
  where workspace_id = target_workspace_id;
  delete from public.candidate_research_plans
  where workspace_id = target_workspace_id;
  delete from public.campaign_candidates
  where workspace_id = target_workspace_id;
  delete from public.candidate_intelligence_versions
  where workspace_id = target_workspace_id;

  -- Entity Resolution and canonical organization graph projections.
  delete from public.organization_split_events
  where workspace_id = target_workspace_id;
  delete from public.organization_merge_events
  where workspace_id = target_workspace_id;
  delete from public.entity_resolution_decisions
  where workspace_id = target_workspace_id;
  delete from public.entity_match_assessments
  where workspace_id = target_workspace_id;
  delete from public.entity_resolution_cases
  where workspace_id = target_workspace_id;
  delete from public.discovery_candidate_group_members_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_candidate_groups_v2
  where workspace_id = target_workspace_id;
  delete from public.entity_resolution_batches_v2
  where workspace_id = target_workspace_id;
  delete from public.organization_source_links
  where workspace_id = target_workspace_id;
  delete from public.organization_buying_hypotheses
  where workspace_id = target_workspace_id;
  delete from public.organization_relationships
  where workspace_id = target_workspace_id;
  delete from public.organization_locations
  where workspace_id = target_workspace_id;
  delete from public.organization_identifiers
  where workspace_id = target_workspace_id;
  delete from public.organization_aliases
  where workspace_id = target_workspace_id;

  -- Scoped Intelligence memory.
  delete from public.memory_application_events
  where workspace_id = target_workspace_id;
  delete from public.memory_promotion_proposals
  where workspace_id = target_workspace_id;
  delete from public.intelligence_conflicts
  where workspace_id = target_workspace_id;
  delete from public.memory_evidence_links
  where workspace_id = target_workspace_id;
  delete from public.user_corrections
  where workspace_id = target_workspace_id;
  delete from public.intelligence_memories
  where workspace_id = target_workspace_id;

  -- Campaign Strategy V2 children with restrictive version references.
  delete from public.campaign_strategy_diffs
  where workspace_id = target_workspace_id;
  delete from public.campaign_strategy_events
  where workspace_id = target_workspace_id;
  delete from public.campaign_market_findings
  where workspace_id = target_workspace_id;
  delete from public.campaign_qualification_factor_definitions
  where workspace_id = target_workspace_id;
  delete from public.campaign_qualification_rubrics
  where workspace_id = target_workspace_id;
  delete from public.campaign_buyer_archetypes
  where workspace_id = target_workspace_id;
  delete from public.campaign_rules_v2
  where workspace_id = target_workspace_id;
  delete from public.campaign_source_plans
  where workspace_id = target_workspace_id;
  delete from public.campaign_objectives
  where workspace_id = target_workspace_id;
  delete from public.campaign_strategy_drafts
  where workspace_id = target_workspace_id;
  delete from public.campaign_inputs
  where workspace_id = target_workspace_id;

  -- Semantic discovery runtime and immutable provider ingestion.
  delete from public.discovery_gap_action_executions_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_query_plans_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_pass_decisions_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_usage_events_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_gap_actions_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_gaps_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_coverage_snapshots_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_queries_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_segment_runs_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_runs_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_source_plans_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_segments_v2
  where workspace_id = target_workspace_id;
  delete from public.discovery_plans_v2
  where workspace_id = target_workspace_id;
  delete from public.campaign_memory_snapshots
  where workspace_id = target_workspace_id;

  -- Company Intelligence V3 normalized records and draft workflow.
  delete from public.profile_change_events
  where workspace_id = target_workspace_id;
  delete from public.profile_task_runs
  where workspace_id = target_workspace_id;
  delete from public.profile_clarification_questions
  where workspace_id = target_workspace_id;
  delete from public.commercial_rules
  where workspace_id = target_workspace_id;
  delete from public.buyer_archetype_hypotheses
  where workspace_id = target_workspace_id;
  delete from public.company_business_roles
  where workspace_id = target_workspace_id;
  delete from public.company_business_models
  where workspace_id = target_workspace_id;
  delete from public.company_offering_versions
  where workspace_id = target_workspace_id;
  delete from public.company_offerings
  where workspace_id = target_workspace_id;
  delete from public.company_profile_drafts
  where workspace_id = target_workspace_id;

  -- Shared evidence and reusable claims.
  delete from public.candidate_claims
  where workspace_id = target_workspace_id;
  delete from public.claim_conflicts
  where workspace_id = target_workspace_id;
  delete from public.claim_evidence_links
  where workspace_id = target_workspace_id;
  update public.intelligence_claims
  set supersedes_claim_id = null
  where workspace_id = target_workspace_id
    and supersedes_claim_id is not null;
  delete from public.intelligence_claims
  where workspace_id = target_workspace_id;
  delete from public.evidence_items
  where workspace_id = target_workspace_id;
  delete from public.candidate_page_fetches
  where workspace_id = target_workspace_id;
  delete from public.normalized_provider_candidates
  where workspace_id = target_workspace_id;
  delete from public.provider_source_records
  where workspace_id = target_workspace_id;
  delete from public.discovery_provider_executions
  where workspace_id = target_workspace_id;
  delete from public.discovery_provider_capability_snapshots
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_candidate_research_v2(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public, anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;

create or replace function public.load_campaign_candidate_research_inputs_v2(
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
  resolution_batch public.entity_resolution_batches_v2;
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
  into resolution_batch
  from public.entity_resolution_batches_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and status = 'completed';
  if resolution_batch.id is null then
    raise exception 'Candidate Research requires completed Entity Resolution.';
  end if;

  with exact_candidates as (
    select distinct
      campaign_candidate.id,
      campaign_candidate.organization_id
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
    where discovery_link.workspace_id = target_workspace_id
  )
  select jsonb_build_object(
    'schemaVersion', 2,
    'campaignRunId', campaign_run.id,
    'campaignId', campaign_run.campaign_id,
    'strategyVersionId', strategy_version.id,
    'strategy', strategy_version.strategy,
    'candidates', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'campaignCandidateId', campaign_candidate.id,
          'organizationId', organization.id,
          'organizationName', organization.name,
          'organizationType', organization.organization_type,
          'canonicalDomain', canonical_domain.normalized_domain,
          'canonicalUrl', case
            when canonical_domain.normalized_domain is not null
              then 'https://' || canonical_domain.normalized_domain || '/'
            else null
          end,
          'procurementAutonomy', buying_hypothesis.procurement_autonomy,
          'matchedArchetypeIds',
            campaign_candidate.matched_archetype_ids_json,
          'discoverySourceIds', coalesce((
            select jsonb_agg(
              distinct discovery_link.provider_source_record_id
              order by discovery_link.provider_source_record_id
            )
            from public.campaign_candidate_discovery_links discovery_link
            join public.entity_resolution_cases resolution_case
              on resolution_case.normalized_candidate_id =
                discovery_link.normalized_candidate_id
              and resolution_case.entity_resolution_batch_id =
                resolution_batch.id
            where discovery_link.campaign_candidate_id =
              campaign_candidate.id
              and discovery_link.provider_source_record_id is not null
          ), '[]'::jsonb),
          'currentIntelligenceVersionId',
            campaign_candidate.current_intelligence_version_id,
          'unresolvedQuestionKeys', coalesce(
            current_intelligence.unresolved_question_keys_json,
            '[]'::jsonb
          ),
          'conflictKeys', coalesce(
            current_intelligence.conflict_keys_json,
            '[]'::jsonb
          ),
          'claimStates', coalesce((
            select jsonb_agg(claim_state order by claim_state->>'key')
            from (
              select distinct jsonb_build_object(
                'key', intelligence_claim.claim_key,
                'epistemicStatus', intelligence_claim.epistemic_status,
                'freshnessState', case
                  when intelligence_claim.observed_at is null
                    then candidate_claim.freshness_state
                  when intelligence_claim.freshness_class = 'stable'
                    and intelligence_claim.observed_at >=
                      now() - interval '730 days'
                    then 'current'
                  when intelligence_claim.freshness_class = 'stable'
                    and intelligence_claim.observed_at >=
                      now() - interval '3650 days'
                    then 'acceptable'
                  when intelligence_claim.freshness_class = 'slow_changing'
                    and intelligence_claim.observed_at >=
                      now() - interval '180 days'
                    then 'current'
                  when intelligence_claim.freshness_class = 'slow_changing'
                    and intelligence_claim.observed_at >=
                      now() - interval '730 days'
                    then 'acceptable'
                  when intelligence_claim.freshness_class = 'dynamic'
                    and intelligence_claim.observed_at >=
                      now() - interval '45 days'
                    then 'current'
                  when intelligence_claim.freshness_class = 'dynamic'
                    and intelligence_claim.observed_at >=
                      now() - interval '180 days'
                    then 'acceptable'
                  when intelligence_claim.freshness_class = 'volatile'
                    and intelligence_claim.observed_at >=
                      now() - interval '14 days'
                    then 'current'
                  when intelligence_claim.freshness_class = 'volatile'
                    and intelligence_claim.observed_at >=
                      now() - interval '45 days'
                    then 'acceptable'
                  else 'stale'
                end,
                'reusableStatus', candidate_claim.reusable_status,
                'reusableScope', 'organization'
              ) as claim_state
              from public.candidate_claims candidate_claim
              join public.intelligence_claims intelligence_claim
                on intelligence_claim.id =
                  candidate_claim.intelligence_claim_id
              where candidate_claim.workspace_id = target_workspace_id
                and candidate_claim.organization_id = organization.id
              union
              select distinct jsonb_build_object(
                'key', intelligence_claim.claim_key,
                'epistemicStatus', intelligence_claim.epistemic_status,
                'freshnessState', coalesce(
                  case
                    when intelligence_claim.freshness_class in (
                      'stable', 'slow_changing'
                    ) then 'acceptable'
                    else 'current'
                  end,
                  'unknown'
                ),
                'reusableStatus', 'active',
                'reusableScope', campaign_claim.claim_scope
              ) as claim_state
              from public.campaign_candidate_claims campaign_claim
              join public.intelligence_claims intelligence_claim
                on intelligence_claim.id =
                  campaign_claim.intelligence_claim_id
              where campaign_claim.workspace_id = target_workspace_id
                and campaign_claim.campaign_candidate_id =
                  campaign_candidate.id
                and campaign_claim.campaign_strategy_version_id =
                  campaign_run.strategy_version_id
            ) states
          ), '[]'::jsonb)
        )
        order by campaign_candidate.id
      )
      from exact_candidates exact_candidate
      join public.campaign_candidates campaign_candidate
        on campaign_candidate.id = exact_candidate.id
      join public.companies organization
        on organization.id = exact_candidate.organization_id
        and organization.workspace_id = target_workspace_id
        and organization.merged_into_company_id is null
      left join lateral (
        select company_domain.normalized_domain
        from public.company_domains company_domain
        where company_domain.workspace_id = target_workspace_id
          and company_domain.company_id = organization.id
          and company_domain.verification_status in (
            'source_confirmed', 'verified'
          )
          and company_domain.collision_status = 'clear'
          and company_domain.domain_role not in (
            'shared_directory', 'provider_hint'
          )
        order by
          company_domain.is_primary desc,
          case company_domain.verification_status
            when 'verified' then 0
            else 1
          end,
          company_domain.normalized_domain
        limit 1
      ) canonical_domain on true
      left join lateral (
        select hypothesis.procurement_autonomy
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
      left join lateral (
        select intelligence_version.*
        from public.candidate_intelligence_versions intelligence_version
        where intelligence_version.workspace_id = target_workspace_id
          and intelligence_version.organization_id = organization.id
        order by
          case
            when intelligence_version.id =
              campaign_candidate.current_intelligence_version_id
              then 0
            else 1
          end,
          intelligence_version.version_number desc
        limit 1
      ) current_intelligence on true
    ), '[]'::jsonb)
  )
  into result;
  return result;
end;
$$;

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
declare
  campaign_run public.campaign_runs;
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
  if jsonb_array_length(target_plans) <> expected_candidate_count then
    raise exception 'Candidate Research plan set does not match Entity Resolution.';
  end if;
  if (
    select count(distinct item->>'campaignCandidateId')
    from jsonb_array_elements(target_plans) item
  ) <> expected_candidate_count then
    raise exception 'Candidate Research plan set contains duplicate candidates.';
  end if;

  insert into public.candidate_research_batches_v2 (
    workspace_id,
    campaign_run_id,
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

create or replace function public.claim_candidate_research_member_v2(
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
  member public.candidate_research_batch_members_v2;
  research_batch public.candidate_research_batches_v2;
  research_plan public.candidate_research_plans;
  campaign_candidate public.campaign_candidates;
  organization public.companies;
  strategy_version public.campaign_strategy_versions;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
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
  select *
  into research_batch
  from public.candidate_research_batches_v2
  where id = member.candidate_research_batch_id
    and workspace_id = target_workspace_id;
  select *
  into research_plan
  from public.candidate_research_plans
  where id = member.research_plan_id
    and workspace_id = target_workspace_id;
  select *
  into campaign_candidate
  from public.campaign_candidates
  where id = member.campaign_candidate_id
    and workspace_id = target_workspace_id;
  select *
  into organization
  from public.companies
  where id = member.organization_id
    and workspace_id = target_workspace_id
    and merged_into_company_id is null;
  select *
  into strategy_version
  from public.campaign_strategy_versions
  where id = research_batch.campaign_strategy_version_id
    and workspace_id = target_workspace_id
    and confirmation_status = 'confirmed';
  if research_batch.id is null
    or research_plan.id is null
    or campaign_candidate.id is null
    or organization.id is null
    or strategy_version.id is null
  then
    raise exception 'Candidate Research member context is incomplete.';
  end if;

  if member.status in ('queued', 'running') then
    update public.candidate_research_batch_members_v2
    set
      status = 'running',
      attempt_count = attempt_count + 1,
      trigger_run_id = target_trigger_run_id,
      started_at = coalesce(started_at, now()),
      error_code = null
    where id = member.id
    returning * into member;
    update public.candidate_research_plans
    set status = 'running'
    where id = research_plan.id
      and status in ('ready', 'running');
    update public.campaign_candidates
    set state = 'researching', updated_at = now()
    where id = campaign_candidate.id
      and state in ('research_planned', 'researching');
  end if;

  insert into public.candidate_research_member_sources_v2 (
    workspace_id,
    candidate_research_member_id,
    source_artifact_id,
    evidence_id
  )
  select
    target_workspace_id,
    member.id,
    artifact.id,
    evidence.id
  from public.candidate_research_source_artifacts_v2 artifact
  join public.evidence_items evidence
    on evidence.workspace_id = target_workspace_id
    and evidence.subject_type = 'organization'
    and evidence.subject_id = member.organization_id
    and (
      (
        artifact.provider_source_record_id is not null
        and evidence.discovery_provider_execution_id = (
          select source_record.provider_execution_id
          from public.provider_source_records source_record
          where source_record.id = artifact.provider_source_record_id
        )
        and evidence.structured_value_json->>'artifactId' =
          artifact.id::text
      )
      or (
        artifact.candidate_page_fetch_id is not null
        and evidence.candidate_page_fetch_id =
          artifact.candidate_page_fetch_id
      )
    )
  left join public.candidate_page_fetches page_fetch
    on page_fetch.id = artifact.candidate_page_fetch_id
  where artifact.workspace_id = target_workspace_id
    and artifact.organization_id = member.organization_id
    and (
      (
        artifact.provider_source_record_id is not null
        and artifact.provider_source_record_id::text in (
          select value
          from jsonb_array_elements_text(
            research_plan.source_plan_json->'discoverySourceIds'
          ) source_id(value)
        )
      )
      or (
        artifact.candidate_page_fetch_id is not null
        and page_fetch.access_status = 'available'
        and page_fetch.expires_at > now()
      )
    )
  on conflict (candidate_research_member_id, source_artifact_id) do nothing;

  return jsonb_build_object(
    'schemaVersion', 2,
    'batchId', research_batch.id,
    'memberId', member.id,
    'workspaceId', target_workspace_id,
    'campaignRunId', research_batch.campaign_run_id,
    'campaignId', research_batch.campaign_id,
    'strategyVersionId', research_batch.campaign_strategy_version_id,
    'campaignCandidateId', member.campaign_candidate_id,
    'organizationId', member.organization_id,
    'organizationName', organization.name,
    'organizationType', organization.organization_type,
    'canonicalDomain', research_plan.source_plan_json->>'canonicalDomain',
    'canonicalUrl', research_plan.source_plan_json->>'canonicalUrl',
    'inputHash', member.input_hash,
    'status', member.status,
    'researchPlanId', research_plan.id,
    'plan', jsonb_build_object(
      'organizationId', research_plan.organization_id,
      'campaignCandidateId', research_plan.campaign_candidate_id,
      'strategyVersionId', research_plan.campaign_strategy_version_id,
      'researchType', research_plan.research_type,
      'questions', research_plan.questions_json,
      'preferredPages',
        research_plan.source_plan_json->'preferredPages',
      'pageBudget', research_plan.page_budget,
      'stopPolicy', research_plan.stop_policy_json
    ),
    'sourcePlan', research_plan.source_plan_json,
    'strategyContext', jsonb_build_object(
      'objective', strategy_version.strategy->'objective',
      'matchedArchetypes', coalesce((
        select jsonb_agg(archetype order by archetype->>'id')
        from jsonb_array_elements(
          strategy_version.strategy->'archetypes'
        ) archetype
        where archetype->>'id' in (
          select value
          from jsonb_array_elements_text(
            campaign_candidate.matched_archetype_ids_json
          ) item(value)
        )
      ), '[]'::jsonb),
      'qualificationFactors',
        strategy_version.strategy #>
          '{qualificationPolicy,factorDefinitions}',
      'hardExclusionRules',
        strategy_version.strategy #>
          '{qualificationPolicy,hardExclusionRules}'
    ),
    'discoverySources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'providerSourceRecordId', source_record.id,
          'providerExecutionId', source_record.provider_execution_id,
          'sourceUrl', source_record.source_url,
          'retrievedAt', source_record.retrieved_at,
          'rawPayload', source_record.raw_payload_json
        )
        order by source_record.id
      )
      from public.provider_source_records source_record
      where source_record.workspace_id = target_workspace_id
        and source_record.id in (
          select value::uuid
          from jsonb_array_elements_text(
            research_plan.source_plan_json->'discoverySourceIds'
          ) source_id(value)
        )
    ), '[]'::jsonb),
    'persistedSources', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'artifactId', artifact.id,
          'evidenceId', member_source.evidence_id,
          'sourceKind', case
            when artifact.provider_source_record_id is not null
              then 'discovery'
            else 'first_party_fetch'
          end,
          'sourceUrl', artifact.source_url,
          'pageKind', artifact.page_kind,
          'retrievedAt', artifact.retrieved_at,
          'contentHash', artifact.content_hash,
          'content', artifact.content_text
        )
        order by artifact.id
      )
      from public.candidate_research_member_sources_v2 member_source
      join public.candidate_research_source_artifacts_v2 artifact
        on artifact.id = member_source.source_artifact_id
      left join public.candidate_page_fetches page_fetch
        on page_fetch.id = artifact.candidate_page_fetch_id
      where member_source.candidate_research_member_id = member.id
        and member_source.workspace_id = target_workspace_id
        and (
          artifact.provider_source_record_id is not null
          or (
            page_fetch.access_status = 'available'
            and page_fetch.expires_at > now()
          )
        )
    ), '[]'::jsonb),
    'outputReference', member.output_reference_json
  );
end;
$$;
