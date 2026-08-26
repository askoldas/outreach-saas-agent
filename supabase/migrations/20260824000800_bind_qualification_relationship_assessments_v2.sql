alter table public.candidate_qualification_batch_members_v2
  add column commercial_relationship_assessment_version_id uuid
    references public.commercial_relationship_assessment_versions_v2(id) on delete restrict;

alter table public.candidate_evaluation_versions
  add column commercial_relationship_assessment_version_id uuid
    references public.commercial_relationship_assessment_versions_v2(id) on delete restrict;

create index candidate_qualification_members_relationship_assessment_idx
  on public.candidate_qualification_batch_members_v2(
    workspace_id, commercial_relationship_assessment_version_id
  ) where commercial_relationship_assessment_version_id is not null;

create or replace function public.bind_qualification_relationship_assessments_v2(
  target_workspace_id uuid,
  target_batch_id uuid,
  target_bindings jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  binding jsonb;
  member public.candidate_qualification_batch_members_v2;
  assessment public.commercial_relationship_assessment_versions_v2;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;
  if jsonb_typeof(target_bindings) <> 'array' then
    raise exception 'Invalid Qualification relationship bindings.';
  end if;

  for binding in select value from jsonb_array_elements(target_bindings)
  loop
    select qualification_member.*
    into member
    from public.candidate_qualification_batch_members_v2 qualification_member
    where qualification_member.workspace_id = target_workspace_id
      and qualification_member.candidate_qualification_batch_id = target_batch_id
      and qualification_member.campaign_candidate_id =
        (binding->>'campaignCandidateId')::uuid
    for update;
    select relationship_assessment.*
    into assessment
    from public.commercial_relationship_assessment_versions_v2 relationship_assessment
    join public.candidate_qualification_batches_v2 qualification_batch
      on qualification_batch.id = target_batch_id
     and qualification_batch.workspace_id = target_workspace_id
     and qualification_batch.campaign_id = relationship_assessment.campaign_id
    join public.campaign_candidates campaign_candidate
      on campaign_candidate.id = member.campaign_candidate_id
     and campaign_candidate.organization_id = relationship_assessment.organization_id
    join public.company_intelligence_versions_v2 company_intelligence
      on company_intelligence.id = relationship_assessment.company_intelligence_version_id
     and company_intelligence.source_candidate_intelligence_version_id =
       member.candidate_intelligence_version_id
    where relationship_assessment.id = (binding->>'assessmentVersionId')::uuid
      and relationship_assessment.workspace_id = target_workspace_id;
    if member.id is null or assessment.id is null then
      raise exception 'Qualification relationship binding references foreign inputs.';
    end if;
    if member.commercial_relationship_assessment_version_id is not null
      and member.commercial_relationship_assessment_version_id <> assessment.id
    then
      raise exception 'Qualification relationship binding changed after freeze.';
    end if;
    update public.candidate_qualification_batch_members_v2
    set commercial_relationship_assessment_version_id = assessment.id
    where id = member.id;
    update public.candidate_evaluation_versions
    set
      commercial_relationship_assessment_version_id = assessment.id,
      compiled_snapshot_json = jsonb_set(
        compiled_snapshot_json,
        '{commercialRelationshipAssessmentVersionId}',
        to_jsonb(assessment.id),
        true
      )
    where id = member.candidate_evaluation_version_id
      and status = 'pending';
  end loop;
end;
$$;

revoke all on function public.bind_qualification_relationship_assessments_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.bind_qualification_relationship_assessments_v2(
  uuid, uuid, jsonb
) to service_role;
