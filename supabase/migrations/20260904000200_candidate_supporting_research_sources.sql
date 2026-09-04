-- Persist bounded third-party Candidate Research evidence without pretending that it
-- is a first-party page or a frozen Discovery source.
-- Apply after 20260904000100_market_research_evidence_corpus.sql.

do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.candidate_research_source_artifacts_v2'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%num_nonnulls%provider_source_record_id%candidate_page_fetch_id%';

  if constraint_name is null then
    raise exception 'Expected Candidate Research source identity constraint was not found.';
  end if;

  execute format(
    'alter table public.candidate_research_source_artifacts_v2 drop constraint %I',
    constraint_name
  );
end;
$$;

alter table public.candidate_research_source_artifacts_v2
  add constraint candidate_research_source_artifacts_v2_identity_check
  check (num_nonnulls(provider_source_record_id, candidate_page_fetch_id) <= 1);

create unique index candidate_research_artifact_supporting_source_idx
on public.candidate_research_source_artifacts_v2(
  organization_id,
  source_url,
  content_hash
)
where provider_source_record_id is null
  and candidate_page_fetch_id is null;

create or replace function public.persist_candidate_supporting_source_v2(
  target_workspace_id uuid,
  target_member_id uuid,
  target_source_url text,
  target_page_kind text,
  target_evidence_type text,
  target_content text,
  target_content_hash text,
  target_retrieved_at timestamptz,
  target_published_at timestamptz,
  target_provider_key text,
  target_provider_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.candidate_research_batch_members_v2;
  artifact public.candidate_research_source_artifacts_v2;
  evidence public.evidence_items;
  evidence_hash text;
  evidence_freshness text;
begin
  if auth.role() <> 'service_role'
    and not public.is_workspace_admin(target_workspace_id)
  then
    raise exception 'Forbidden';
  end if;
  if target_page_kind not in ('news', 'careers', 'other')
    or target_evidence_type not in (
      'news_article', 'job_posting', 'official_document',
      'legal_registry', 'company_database', 'directory_profile',
      'social_company_profile', 'map_listing', 'marketplace_profile'
    )
    or length(target_content_hash) <> 64
    or encode(digest(target_content, 'sha256'), 'hex') <> target_content_hash
    or length(target_content) not between 1 and 100000
    or nullif(trim(target_source_url), '') is null
    or target_source_url !~* '^https://'
    or nullif(trim(target_provider_key), '') is null
  then
    raise exception 'Invalid supporting Candidate Research source payload.';
  end if;

  select *
  into member
  from public.candidate_research_batch_members_v2
  where id = target_member_id
    and workspace_id = target_workspace_id
  for update;
  if member.id is null or member.status not in ('running', 'completed', 'blocked') then
    raise exception 'Candidate Research member is not source-ready.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'candidate-supporting-source:' ||
    target_workspace_id::text || '|' ||
    member.organization_id::text || '|' ||
    target_source_url || '|' || target_content_hash,
    0
  ));

  select *
  into artifact
  from public.candidate_research_source_artifacts_v2 existing
  where existing.organization_id = member.organization_id
    and existing.source_url = target_source_url
    and existing.content_hash = target_content_hash
    and existing.provider_source_record_id is null
    and existing.candidate_page_fetch_id is null;
  if artifact.id is null then
    insert into public.candidate_research_source_artifacts_v2 (
      workspace_id,
      organization_id,
      source_url,
      page_kind,
      content_text,
      content_hash,
      retrieved_at
    ) values (
      target_workspace_id,
      member.organization_id,
      target_source_url,
      target_page_kind,
      target_content,
      target_content_hash,
      target_retrieved_at
    )
    returning * into artifact;
  end if;

  evidence_hash := encode(digest(
    'candidate-supporting-research-v2|' ||
    member.organization_id::text || '|' ||
    artifact.id::text || '|' || target_content_hash,
    'sha256'
  ), 'hex');
  evidence_freshness := case
    when target_published_at is null then 'unknown'
    when target_published_at >= target_retrieved_at - interval '45 days' then 'current'
    when target_published_at >= target_retrieved_at - interval '365 days' then 'recent'
    else 'stale'
  end;

  select *
  into evidence
  from public.evidence_items existing
  where existing.workspace_id = target_workspace_id
    and existing.subject_type = 'organization'
    and existing.subject_id = member.organization_id
    and existing.content_hash = evidence_hash;
  if evidence.id is null then
    insert into public.evidence_items (
      workspace_id,
      subject_type,
      subject_id,
      manual_source_label,
      evidence_type,
      structured_value_json,
      excerpt,
      location_json,
      directness,
      source_reliability,
      freshness_state,
      observed_at,
      retrieved_at,
      content_hash,
      visibility
    ) values (
      target_workspace_id,
      'organization',
      member.organization_id,
      'candidate-research-supporting-search:' || target_provider_key,
      target_evidence_type,
      jsonb_build_object(
        'artifactId', artifact.id,
        'pageKind', target_page_kind,
        'sourceUrl', target_source_url,
        'providerKey', target_provider_key,
        'providerRequestId', target_provider_request_id
      ),
      left(target_content, 800),
      jsonb_build_object('url', target_source_url, 'artifactId', artifact.id),
      'reported',
      'unverified_secondary',
      evidence_freshness,
      target_published_at,
      target_retrieved_at,
      evidence_hash,
      'public'
    )
    returning * into evidence;
  end if;

  insert into public.candidate_research_member_sources_v2 (
    workspace_id,
    candidate_research_member_id,
    source_artifact_id,
    evidence_id
  ) values (
    target_workspace_id,
    member.id,
    artifact.id,
    evidence.id
  )
  on conflict (candidate_research_member_id, source_artifact_id) do nothing;

  insert into public.candidate_research_tasks (
    workspace_id,
    research_plan_id,
    question_key,
    task_type,
    source_url,
    evidence_id,
    status,
    priority,
    idempotency_key,
    result_reference_json,
    started_at,
    completed_at
  ) values (
    target_workspace_id,
    member.research_plan_id,
    '__supporting_source__',
    'fetch_external_source',
    target_source_url,
    evidence.id,
    'completed',
    90,
    'supporting-source:' || artifact.id::text,
    jsonb_build_object(
      'artifactId', artifact.id,
      'evidenceId', evidence.id,
      'contentHash', artifact.content_hash,
      'providerKey', target_provider_key,
      'providerRequestId', target_provider_request_id
    ),
    now(),
    now()
  )
  on conflict (research_plan_id, idempotency_key) do nothing;

  return jsonb_build_object(
    'artifactId', artifact.id,
    'evidenceId', evidence.id,
    'sourceKind', 'supporting_search',
    'sourceUrl', artifact.source_url,
    'pageKind', artifact.page_kind,
    'retrievedAt', artifact.retrieved_at,
    'contentHash', artifact.content_hash,
    'content', artifact.content_text
  );
end;
$$;

revoke all on function public.persist_candidate_supporting_source_v2(
  uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,text,text
) from public, anon, authenticated;
grant execute on function public.persist_candidate_supporting_source_v2(
  uuid,uuid,text,text,text,text,text,timestamptz,timestamptz,text,text
) to service_role;
