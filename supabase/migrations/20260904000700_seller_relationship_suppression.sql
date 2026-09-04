-- Trusted seller/workspace relationship memory available before first-campaign research.
create table if not exists public.organization_relationship_memories_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid,
  organization_name text not null check (length(trim(organization_name)) > 0),
  canonical_domain text,
  relationship_type text not null check (relationship_type in
    ('existing_customer','former_customer','partner','competitor','excluded','unknown')),
  status text not null check (status in ('confirmed','probable','ambiguous')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids text[] not null default '{}',
  source text not null check (source in
    ('company_profile','seller_site','user_confirmed','prior_campaign','crm','other')),
  scope text not null check (scope in ('workspace','company','offering','campaign')),
  scope_id uuid,
  created_at timestamptz not null default now(),
  check (canonical_domain is not null or organization_id is not null or length(trim(organization_name)) > 0),
  check (status <> 'confirmed' or (confidence >= 0.8 and cardinality(evidence_ids) > 0)),
  foreign key (workspace_id, organization_id)
    references public.companies(workspace_id, id) on delete cascade
);
create index if not exists organization_relationship_memories_v2_lookup_idx
  on public.organization_relationship_memories_v2(workspace_id, relationship_type, status);
alter table public.organization_relationship_memories_v2 enable row level security;
revoke all on public.organization_relationship_memories_v2 from anon, authenticated;
grant select on public.organization_relationship_memories_v2 to authenticated;

create or replace function public.load_pre_research_suppression_context_v2(
  target_workspace_id uuid, target_campaign_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;
  if not exists (select 1 from public.campaigns c where c.id=target_campaign_id and c.workspace_id=target_workspace_id)
  then raise exception 'Campaign does not belong to workspace.'; end if;

  select coalesce(jsonb_agg(to_jsonb(memory) order by memory."organizationId" nulls last, memory."normalizedNames"), '[]'::jsonb)
  into result from (
    select
      candidate.organization_id as "organizationId",
      assessment.primary_relationship as relationship,
      case when assessment.confidence >= .8 and jsonb_array_length(assessment.evidence_ids_json)>0 then 'confirmed'
           when assessment.confidence >= .6 then 'probable' else 'ambiguous' end as status,
      assessment.confidence::double precision as confidence,
      assessment.evidence_ids_json as "evidenceIds", 'prior_qualification'::text as source,
      coalesce((select jsonb_agg(d.normalized_domain order by d.normalized_domain) from public.company_domains d
        where d.workspace_id=target_workspace_id and d.company_id=candidate.organization_id
          and d.verification_status in ('source_confirmed','verified') and d.collision_status='clear'),'[]'::jsonb) as "canonicalDomains",
      (select jsonb_agg(n.normalized_name order by n.normalized_name) from (
        select company.normalized_name union select a.normalized_alias from public.organization_aliases a
        where a.workspace_id=target_workspace_id and a.organization_id=candidate.organization_id
          and a.confidence>=.95 and jsonb_array_length(a.evidence_ids_json)>0) n) as "normalizedNames"
    from public.candidate_relationship_assessments assessment
    join public.candidate_evaluation_versions evaluation on evaluation.id=assessment.candidate_evaluation_version_id
      and evaluation.workspace_id=target_workspace_id and evaluation.status in ('finalized','requires_manual_review')
    join public.campaign_candidates candidate on candidate.id=evaluation.campaign_candidate_id and candidate.workspace_id=target_workspace_id
    join public.companies company on company.id=candidate.organization_id and company.workspace_id=target_workspace_id
    where assessment.workspace_id=target_workspace_id and assessment.primary_relationship in
      ('existing_customer','former_customer','competitor','reseller','distributor','channel_partner','integration_partner','referral_partner','strategic_partner')
    union all
    select relationship.organization_id as "organizationId", relationship.relationship_type as relationship,
      relationship.status, relationship.confidence::double precision,
      to_jsonb(relationship.evidence_ids) as "evidenceIds", relationship.source,
      case when relationship.canonical_domain is null then '[]'::jsonb else jsonb_build_array(lower(relationship.canonical_domain)) end as "canonicalDomains",
      jsonb_build_array(lower(regexp_replace(trim(relationship.organization_name),'[^[:alnum:]]+',' ','g'))) as "normalizedNames"
    from public.organization_relationship_memories_v2 relationship
    where relationship.workspace_id=target_workspace_id and (
      relationship.scope in ('workspace','company')
      or (relationship.scope='campaign' and relationship.scope_id=target_campaign_id)
    )
  ) memory;
  return jsonb_build_object('schemaVersion',1,'workspaceId',target_workspace_id,'campaignId',target_campaign_id,'entries',result);
end; $$;
revoke all on function public.load_pre_research_suppression_context_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.load_pre_research_suppression_context_v2(uuid,uuid) to service_role;
