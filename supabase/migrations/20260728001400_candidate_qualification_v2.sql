-- Deterministic Candidate Qualification V2 persistence.
-- Apply after 20260728001300_candidate_research_intelligence.sql.

create table public.qualification_rubrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  factor_library_version text not null,
  scoring_policy_version text not null,
  relationship_classifier_version text not null,
  exclusion_policy_version text not null,
  factors_json jsonb not null check (jsonb_typeof(factors_json) = 'array'),
  thresholds_json jsonb not null check (jsonb_typeof(thresholds_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (campaign_strategy_version_id, content_hash)
);

create table public.candidate_evaluation_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  campaign_strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  candidate_intelligence_version_id uuid not null references public.candidate_intelligence_versions(id) on delete restrict,
  qualification_rubric_id uuid not null references public.qualification_rubrics(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status text not null default 'pending' check (status in (
    'pending','relationship_classifying','exclusion_checking','research_planning',
    'researching','factor_evaluating','scoring','consistency_checking',
    'comparative_pending','finalized','requires_manual_review','failed','superseded'
  )),
  compiled_snapshot_json jsonb not null check (jsonb_typeof(compiled_snapshot_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  unique (campaign_candidate_id, version_number),
  unique (campaign_candidate_id, content_hash)
);

create table public.candidate_relationship_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  primary_relationship text not null,
  secondary_relationships_json jsonb not null default '[]'::jsonb check (jsonb_typeof(secondary_relationships_json) = 'array'),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  decision_basis text not null check (decision_basis in ('direct_evidence','strong_inference','weak_inference','insufficient_evidence')),
  evidence_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_ids_json) = 'array'),
  unresolved_questions_json jsonb not null default '[]'::jsonb check (jsonb_typeof(unresolved_questions_json) = 'array'),
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id)
);

create table public.candidate_exclusion_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  rule_key text not null,
  state text not null check (state in ('triggered','suspected','not_triggered','unknown','not_applicable')),
  strength text not null check (strength in ('hard','soft','informational')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  effect text not null,
  evidence_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_ids_json) = 'array'),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id, rule_key)
);

create table public.candidate_factor_evaluations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  factor_key text not null,
  state text not null check (state in ('positive','negative','unknown','conflicting','not_applicable')),
  signed_value numeric(6,5) check (signed_value between -1 and 1),
  potential_value numeric(6,5) check (potential_value between 0 and 1),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_quality numeric(5,4) not null check (evidence_quality between 0 and 1),
  critical_gate_state text check (critical_gate_state is null or critical_gate_state in ('passed','failed','unresolved','not_applicable')),
  evidence_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_ids_json) = 'array'),
  counter_evidence_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(counter_evidence_ids_json) = 'array'),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id, factor_key)
);

create table public.candidate_score_calculations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  score_type text not null check (score_type in ('fit','commercial_potential')),
  score integer check (score between 0 and 100),
  raw_weighted_mean numeric,
  denominator numeric not null check (denominator >= 0),
  trace_json jsonb not null check (jsonb_typeof(trace_json) = 'object'),
  policy_version text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id, score_type)
);

create table public.candidate_confidence_calculations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  overall_confidence integer not null check (overall_confidence between 0 and 100),
  components_json jsonb not null check (jsonb_typeof(components_json) = 'object'),
  caps_json jsonb not null default '[]'::jsonb check (jsonb_typeof(caps_json) = 'array'),
  policy_version text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id)
);

create table public.candidate_eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  eligibility text not null check (eligibility in ('eligible','conditional','requires_research','excluded','rejected','invalid_entity','duplicate_or_merged')),
  reason_code text not null,
  reason_text text not null,
  decided_by text not null default 'rules' check (decided_by in ('rules','user','hybrid')),
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id)
);

create table public.candidate_review_lane_assignments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  lane text not null check (lane in ('recommended','conditional','requires_research','rejected','excluded','invalid','duplicate')),
  reason text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id)
);

create or replace function public.validate_candidate_qualification_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name = 'qualification_rubrics' then
    select workspace_id into expected_workspace_id from public.campaign_strategy_versions where id = new.campaign_strategy_version_id;
  elsif tg_table_name = 'candidate_evaluation_versions' then
    select workspace_id into expected_workspace_id from public.campaign_candidates where id = new.campaign_candidate_id;
    if not exists (select 1 from public.candidate_intelligence_versions where id = new.candidate_intelligence_version_id and workspace_id = expected_workspace_id)
    then raise exception 'Candidate evaluation Intelligence mismatch.'; end if;
  else
    select workspace_id into expected_workspace_id from public.candidate_evaluation_versions where id = new.candidate_evaluation_version_id;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then raise exception 'Candidate qualification workspace mismatch.'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'qualification_rubrics','candidate_evaluation_versions','candidate_relationship_assessments',
    'candidate_exclusion_assessments','candidate_factor_evaluations','candidate_score_calculations',
    'candidate_confidence_calculations','candidate_eligibility_decisions','candidate_review_lane_assignments'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.validate_candidate_qualification_workspace()', table_name || '_workspace_guard', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', 'Members can read ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))', 'Admins can manage ' || table_name, table_name);
  end loop;
end;
$$;
