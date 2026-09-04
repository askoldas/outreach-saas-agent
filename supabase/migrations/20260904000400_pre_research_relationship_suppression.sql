-- Evidence-backed relationship memory for pre-research suppression.

create or replace function public.load_pre_research_suppression_context_v2(
  target_workspace_id uuid,
  target_campaign_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if not exists (
    select 1
    from public.campaigns campaign
    where campaign.id = target_campaign_id
      and campaign.workspace_id = target_workspace_id
  ) then
    raise exception 'Campaign does not belong to workspace.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(memory) order by memory."organizationId"), '[]'::jsonb)
  into result
  from (
    select distinct on (candidate.organization_id)
      candidate.organization_id as "organizationId",
      assessment.primary_relationship as relationship,
      case
        when assessment.confidence >= 0.8
          and jsonb_array_length(assessment.evidence_ids_json) > 0
          then 'confirmed'
        when assessment.confidence >= 0.6 then 'probable'
        else 'ambiguous'
      end as status,
      assessment.confidence::double precision as confidence,
      assessment.evidence_ids_json as "evidenceIds",
      'prior_qualification'::text as source,
      coalesce((
        select jsonb_agg(domain.normalized_domain order by domain.normalized_domain)
        from public.company_domains domain
        where domain.workspace_id = target_workspace_id
          and domain.company_id = candidate.organization_id
          and domain.verification_status in ('source_confirmed', 'verified')
          and domain.collision_status = 'clear'
      ), '[]'::jsonb) as "canonicalDomains",
      (
        select jsonb_agg(names.normalized_name order by names.normalized_name)
        from (
          select company.normalized_name
          union
          select alias.normalized_alias
          from public.organization_aliases alias
          where alias.workspace_id = target_workspace_id
            and alias.organization_id = candidate.organization_id
            and alias.confidence >= 0.95
            and jsonb_array_length(alias.evidence_ids_json) > 0
        ) names
      ) as "normalizedNames"
    from public.candidate_relationship_assessments assessment
    join public.candidate_evaluation_versions evaluation
      on evaluation.id = assessment.candidate_evaluation_version_id
     and evaluation.workspace_id = target_workspace_id
     and evaluation.status in ('finalized', 'requires_manual_review')
    join public.campaign_candidates candidate
      on candidate.id = evaluation.campaign_candidate_id
     and candidate.workspace_id = target_workspace_id
    join public.companies company
      on company.id = candidate.organization_id
     and company.workspace_id = target_workspace_id
    where assessment.workspace_id = target_workspace_id
      and assessment.primary_relationship in (
        'existing_customer', 'former_customer', 'competitor',
        'reseller', 'distributor', 'channel_partner',
        'integration_partner', 'referral_partner', 'strategic_partner'
      )
    order by candidate.organization_id, assessment.created_at desc
  ) memory;

  return jsonb_build_object(
    'schemaVersion', 1,
    'workspaceId', target_workspace_id,
    'campaignId', target_campaign_id,
    'entries', result
  );
end;
$$;

revoke all on function public.load_pre_research_suppression_context_v2(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.load_pre_research_suppression_context_v2(uuid, uuid)
to service_role;
