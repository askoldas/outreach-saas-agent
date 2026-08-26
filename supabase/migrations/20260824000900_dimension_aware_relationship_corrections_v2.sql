alter table public.candidate_corrections_v2
  add column relationship_dimension text,
  add column source_relationship_assessment_version_id uuid
    references public.commercial_relationship_assessment_versions_v2(id) on delete restrict;

alter table public.candidate_corrections_v2
  add constraint candidate_corrections_v2_relationship_source_check check (
    (correction_type = 'relationship')
    or (
      relationship_dimension is null
      and source_relationship_assessment_version_id is null
    )
  );

create index candidate_corrections_v2_relationship_source_idx
  on public.candidate_corrections_v2(
    workspace_id, source_relationship_assessment_version_id, created_at desc
  ) where source_relationship_assessment_version_id is not null;

drop function public.propose_candidate_correction_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, text
);

create function public.propose_candidate_correction_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_campaign_candidate_id uuid,
  target_evaluation_version_id uuid,
  target_correction_type text,
  target_proposed_value_json jsonb,
  target_reason text,
  target_scope text default 'campaign',
  target_relationship_dimension text default null,
  target_source_relationship_assessment_version_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_correction_type not in (
    'relationship', 'archetype', 'entity', 'evidence',
    'procurement', 'location', 'duplicate_state'
  ) or target_scope not in ('candidate', 'campaign', 'offering', 'workspace')
    or jsonb_typeof(target_proposed_value_json) <> 'object'
    or length(trim(target_reason)) = 0 then
    raise exception 'Invalid correction proposal';
  end if;

  if target_correction_type = 'relationship' then
    if length(trim(coalesce(target_relationship_dimension, ''))) = 0
      or target_source_relationship_assessment_version_id is null then
      raise exception 'Relationship corrections require a dimension and source assessment';
    end if;
  elsif target_relationship_dimension is not null
    or target_source_relationship_assessment_version_id is not null then
    raise exception 'Only relationship corrections may target a relationship dimension';
  end if;

  if not exists (
    select 1
    from public.campaign_runs run
    join public.campaign_candidates candidate
      on candidate.campaign_id = run.campaign_id
      and candidate.workspace_id = run.workspace_id
    join public.candidate_evaluation_versions evaluation
      on evaluation.id = target_evaluation_version_id
      and evaluation.campaign_candidate_id = candidate.id
      and evaluation.workspace_id = run.workspace_id
    where run.id = target_campaign_run_id
      and run.workspace_id = target_workspace_id
      and candidate.id = target_campaign_candidate_id
  ) then
    raise exception 'Correction target does not belong to this Campaign Run';
  end if;

  if target_correction_type = 'relationship' and not exists (
    select 1
    from public.candidate_evaluation_versions evaluation
    join public.campaign_candidates candidate
      on candidate.id = evaluation.campaign_candidate_id
     and candidate.workspace_id = evaluation.workspace_id
    join public.campaign_runs run
      on run.id = target_campaign_run_id
     and run.workspace_id = evaluation.workspace_id
     and run.campaign_id = candidate.campaign_id
    join public.commercial_relationship_assessment_versions_v2 assessment
      on assessment.id = evaluation.commercial_relationship_assessment_version_id
     and assessment.id = target_source_relationship_assessment_version_id
     and assessment.workspace_id = evaluation.workspace_id
     and assessment.campaign_id = run.campaign_id
     and assessment.organization_id = candidate.organization_id
    where evaluation.id = target_evaluation_version_id
      and evaluation.workspace_id = target_workspace_id
      and assessment.assessment_json -> 'relationships'
        ? target_relationship_dimension
  ) then
    raise exception 'Relationship correction does not match its frozen assessment';
  end if;

  insert into public.candidate_corrections_v2 (
    workspace_id, campaign_run_id, campaign_candidate_id,
    candidate_evaluation_version_id, correction_type, proposed_value_json,
    reason, scope, relationship_dimension,
    source_relationship_assessment_version_id, created_by
  ) values (
    target_workspace_id, target_campaign_run_id, target_campaign_candidate_id,
    target_evaluation_version_id, target_correction_type,
    target_proposed_value_json, trim(target_reason), target_scope,
    nullif(trim(coalesce(target_relationship_dimension, '')), ''),
    target_source_relationship_assessment_version_id, auth.uid()
  )
  returning id into saved_id;

  insert into public.candidate_evaluation_events (
    workspace_id, candidate_evaluation_version_id, event_type, event_payload_json
  ) values (
    target_workspace_id, target_evaluation_version_id, 'user_correction_proposed',
    jsonb_strip_nulls(jsonb_build_object(
      'correctionId', saved_id,
      'correctionType', target_correction_type,
      'scope', target_scope,
      'relationshipDimension', target_relationship_dimension,
      'sourceRelationshipAssessmentVersionId',
        target_source_relationship_assessment_version_id
    ))
  );

  return saved_id;
end;
$$;

revoke all on function public.propose_candidate_correction_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, text, text, uuid
) from public, anon;
grant execute on function public.propose_candidate_correction_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, text, text, uuid
) to authenticated;
