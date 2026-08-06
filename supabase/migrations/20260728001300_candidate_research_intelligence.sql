-- Question-driven candidate research and reusable Candidate Intelligence.
-- Apply after 20260728001200_organization_graph_entity_resolution.sql.

alter table public.intelligence_claims
  add column observed_at timestamptz,
  add column freshness_class text check (
    freshness_class is null or freshness_class in (
      'stable', 'slow_changing', 'dynamic', 'volatile'
    )
  ),
  add column source_scope text not null default 'workspace_private'
    check (source_scope in ('system_public', 'workspace_private'));

create table public.campaign_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete restrict,
  buying_organization_id uuid references public.companies(id) on delete restrict,
  display_organization_id uuid not null references public.companies(id) on delete restrict,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  state text not null default 'discovered' check (state in (
    'discovered', 'identity_review', 'research_planned', 'researching',
    'research_blocked', 'ready_for_evaluation', 'invalid', 'merged', 'archived'
  )),
  matched_archetype_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matched_archetype_ids_json) = 'array'),
  discovered_country text,
  user_review_status text not null default 'unreviewed' check (
    user_review_status in (
      'unreviewed', 'approved', 'rejected', 'needs_review', 'corrected'
    )
  ),
  current_intelligence_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, organization_id, campaign_strategy_version_id)
);

create table public.candidate_research_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  campaign_candidate_id uuid references public.campaign_candidates(id) on delete cascade,
  campaign_strategy_version_id uuid
    references public.campaign_strategy_versions(id) on delete restrict,
  research_type text not null check (
    research_type in ('reusable', 'campaign_specific')
  ),
  version_number integer not null check (version_number > 0),
  questions_json jsonb not null check (jsonb_typeof(questions_json) = 'array'),
  source_plan_json jsonb not null check (jsonb_typeof(source_plan_json) = 'object'),
  stop_policy_json jsonb not null check (jsonb_typeof(stop_policy_json) = 'object'),
  priority integer not null check (priority between 1 and 100),
  page_budget integer not null check (page_budget between 1 and 50),
  status text not null default 'ready' check (status in (
    'draft', 'ready', 'running', 'completed', 'blocked',
    'cancelled', 'superseded'
  )),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (workspace_id, content_hash)
);

create unique index candidate_research_plans_reusable_version_idx
on public.candidate_research_plans(organization_id, version_number)
where campaign_candidate_id is null;
create unique index candidate_research_plans_campaign_version_idx
on public.candidate_research_plans(campaign_candidate_id, version_number)
where campaign_candidate_id is not null;

create table public.candidate_research_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  research_plan_id uuid not null
    references public.candidate_research_plans(id) on delete cascade,
  question_key text not null check (length(trim(question_key)) > 0),
  task_type text not null check (task_type in (
    'reuse_evidence', 'fetch_first_party_page', 'fetch_external_source',
    'extract_claims', 'verify_claim', 'resolve_conflict', 'compile_intelligence'
  )),
  source_url text,
  evidence_id uuid references public.evidence_items(id) on delete restrict,
  status text not null default 'queued' check (status in (
    'queued', 'running', 'completed', 'failed', 'blocked',
    'skipped_reused', 'cancelled'
  )),
  priority integer not null check (priority between 1 and 100),
  idempotency_key text not null,
  result_reference_json jsonb
    check (result_reference_json is null or jsonb_typeof(result_reference_json) = 'object'),
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (research_plan_id, idempotency_key)
);

create table public.candidate_page_fetches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  canonical_url text not null check (length(trim(canonical_url)) > 0),
  page_kind text not null check (page_kind in (
    'home', 'about', 'products_services', 'brands_partners', 'locations',
    'legal', 'supplier_procurement', 'careers', 'investor_relations',
    'news', 'contact', 'wholesale_b2b', 'other'
  )),
  freshness_window_started_at timestamptz not null,
  access_status text not null check (
    access_status in ('available', 'blocked', 'removed', 'partial', 'failed')
  ),
  http_status integer,
  content_hash text,
  retrieved_at timestamptz not null,
  expires_at timestamptz not null,
  raw_artifact_reference text,
  created_at timestamptz not null default now(),
  check (expires_at > freshness_window_started_at),
  unique (workspace_id, canonical_url, freshness_window_started_at)
);

create table public.candidate_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  intelligence_claim_id uuid not null
    references public.intelligence_claims(id) on delete restrict,
  freshness_state text not null check (
    freshness_state in ('current', 'acceptable', 'stale', 'unknown')
  ),
  reusable_status text not null default 'active'
    check (reusable_status in ('active', 'conflicting', 'superseded', 'rejected')),
  created_at timestamptz not null default now(),
  unique (intelligence_claim_id)
);

create table public.candidate_intelligence_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  source_cutoff_at timestamptz not null,
  compiled_snapshot_json jsonb not null
    check (jsonb_typeof(compiled_snapshot_json) = 'object'),
  claim_ids_json jsonb not null check (jsonb_typeof(claim_ids_json) = 'array'),
  evidence_ids_json jsonb not null check (jsonb_typeof(evidence_ids_json) = 'array'),
  unresolved_question_keys_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(unresolved_question_keys_json) = 'array'),
  conflict_keys_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(conflict_keys_json) = 'array'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (organization_id, version_number),
  unique (organization_id, content_hash)
);

alter table public.campaign_candidates
  add constraint campaign_candidates_current_intelligence_version_fk
  foreign key (current_intelligence_version_id)
  references public.candidate_intelligence_versions(id) on delete set null;

create table public.campaign_candidate_discovery_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_candidate_id uuid not null
    references public.campaign_candidates(id) on delete cascade,
  normalized_candidate_id uuid
    references public.normalized_provider_candidates(id) on delete restrict,
  provider_source_record_id uuid
    references public.provider_source_records(id) on delete restrict,
  discovery_segment_key text,
  created_at timestamptz not null default now(),
  check (num_nonnulls(
    normalized_candidate_id, provider_source_record_id, discovery_segment_key
  ) >= 1),
  unique (
    campaign_candidate_id, normalized_candidate_id,
    provider_source_record_id, discovery_segment_key
  )
);

create table public.campaign_candidate_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_candidate_id uuid not null
    references public.campaign_candidates(id) on delete cascade,
  intelligence_claim_id uuid not null
    references public.intelligence_claims(id) on delete restrict,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  claim_scope text not null check (
    claim_scope in ('offering_context', 'campaign_only')
  ),
  created_at timestamptz not null default now(),
  unique (
    campaign_candidate_id, intelligence_claim_id, campaign_strategy_version_id
  )
);

create index candidate_research_plans_active_idx
on public.candidate_research_plans(workspace_id, organization_id, status)
where status in ('ready', 'running', 'blocked');
create index candidate_research_tasks_queue_idx
on public.candidate_research_tasks(workspace_id, status, priority desc, created_at)
where status in ('queued', 'running');
create index candidate_page_fetches_reuse_idx
on public.candidate_page_fetches(
  workspace_id, organization_id, canonical_url, expires_at desc
);
create index candidate_claims_organization_idx
on public.candidate_claims(
  workspace_id, organization_id, reusable_status, freshness_state
);

create or replace function public.validate_candidate_intelligence_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
declare expected_campaign_id uuid;
begin
  if tg_table_name in (
    'candidate_research_plans', 'candidate_page_fetches',
    'candidate_claims', 'candidate_intelligence_versions'
  ) then
    select workspace_id into expected_workspace_id from public.companies
    where id = new.organization_id;
    if tg_table_name = 'candidate_claims' then
      if not exists (
        select 1 from public.intelligence_claims
        where id = new.intelligence_claim_id
          and workspace_id = expected_workspace_id
          and subject_type = 'organization'
          and subject_id = new.organization_id
      ) then raise exception 'Candidate claim subject mismatch.'; end if;
    elsif tg_table_name = 'candidate_research_plans' then
      if new.campaign_candidate_id is not null and not exists (
        select 1 from public.campaign_candidates
        where id = new.campaign_candidate_id
          and organization_id = new.organization_id
          and workspace_id = expected_workspace_id
      )
      then raise exception 'Candidate research plan subject mismatch.'; end if;
    end if;
  elsif tg_table_name = 'campaign_candidates' then
    select workspace_id into expected_workspace_id from public.campaigns
    where id = new.campaign_id;
    if not exists (
      select 1 from public.companies
      where id = new.organization_id and workspace_id = expected_workspace_id
    ) or not exists (
      select 1 from public.companies
      where id = new.display_organization_id and workspace_id = expected_workspace_id
    ) or (
      new.buying_organization_id is not null and not exists (
        select 1 from public.companies
        where id = new.buying_organization_id and workspace_id = expected_workspace_id
      )
    ) then raise exception 'Campaign Candidate organization mismatch.'; end if;
    if not exists (
      select 1 from public.campaign_strategy_versions
      where id = new.campaign_strategy_version_id
        and campaign_id = new.campaign_id
        and workspace_id = expected_workspace_id
    ) then raise exception 'Campaign Candidate strategy mismatch.'; end if;
  elsif tg_table_name = 'candidate_research_tasks' then
    select workspace_id into expected_workspace_id
    from public.candidate_research_plans where id = new.research_plan_id;
  elsif tg_table_name in (
    'campaign_candidate_discovery_links', 'campaign_candidate_claims'
  ) then
    select workspace_id, campaign_id into expected_workspace_id, expected_campaign_id
    from public.campaign_candidates where id = new.campaign_candidate_id;
    if tg_table_name = 'campaign_candidate_claims' then
      if not exists (
        select 1 from public.campaign_strategy_versions
        where id = new.campaign_strategy_version_id
          and campaign_id = expected_campaign_id
          and workspace_id = expected_workspace_id
      ) then raise exception 'Campaign Candidate claim strategy mismatch.'; end if;
    elsif tg_table_name = 'campaign_candidate_discovery_links' then
      if (
        new.normalized_candidate_id is not null and not exists (
          select 1 from public.normalized_provider_candidates
          where id = new.normalized_candidate_id
            and campaign_id = expected_campaign_id
            and workspace_id = expected_workspace_id
        )
      ) or (
        new.provider_source_record_id is not null and not exists (
          select 1 from public.provider_source_records
          where id = new.provider_source_record_id
            and campaign_id = expected_campaign_id
            and workspace_id = expected_workspace_id
        )
      ) or (
        new.discovery_segment_key is not null and not exists (
          select 1 from public.normalized_provider_candidates
          where campaign_id = expected_campaign_id
            and workspace_id = expected_workspace_id
            and matched_segment_key = new.discovery_segment_key
          union all
          select 1 from public.provider_source_records
          where campaign_id = expected_campaign_id
            and workspace_id = expected_workspace_id
            and discovery_segment_key = new.discovery_segment_key
        )
      ) then raise exception 'Campaign Candidate discovery lineage mismatch.'; end if;
    end if;
  else
    raise exception 'Unsupported Candidate Intelligence workspace guard.';
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Candidate Intelligence workspace mismatch.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'campaign_candidates', 'candidate_research_plans', 'candidate_research_tasks',
    'candidate_page_fetches', 'candidate_claims',
    'candidate_intelligence_versions', 'campaign_candidate_discovery_links',
    'campaign_candidate_claims'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_candidate_intelligence_workspace()',
      table_name || '_workspace_guard', table_name
    );
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name, table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      'Admins can manage ' || table_name, table_name
    );
  end loop;
end;
$$;

create or replace function public.publish_candidate_intelligence_v2(
  target_workspace_id uuid,
  target_organization_id uuid,
  target_source_cutoff_at timestamptz,
  target_snapshot jsonb,
  target_claim_ids jsonb,
  target_evidence_ids jsonb,
  target_unresolved_keys jsonb,
  target_conflict_keys jsonb,
  target_content_hash text
)
returns public.candidate_intelligence_versions
language plpgsql security definer set search_path = public as $$
declare published public.candidate_intelligence_versions;
declare next_version integer;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.companies
    where id = target_organization_id and workspace_id = target_workspace_id
      and merged_into_company_id is null
  ) then raise exception 'Canonical organization not found.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_organization_id::text, 0));
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.candidate_intelligence_versions
  where organization_id = target_organization_id;
  insert into public.candidate_intelligence_versions (
    workspace_id, organization_id, version_number, source_cutoff_at,
    compiled_snapshot_json, claim_ids_json, evidence_ids_json,
    unresolved_question_keys_json, conflict_keys_json, content_hash
  ) values (
    target_workspace_id, target_organization_id, next_version,
    target_source_cutoff_at, target_snapshot, target_claim_ids,
    target_evidence_ids, coalesce(target_unresolved_keys, '[]'::jsonb),
    coalesce(target_conflict_keys, '[]'::jsonb), target_content_hash
  )
  on conflict (organization_id, content_hash) do nothing
  returning * into published;
  if published.id is null then
    select * into published from public.candidate_intelligence_versions
    where organization_id = target_organization_id
      and content_hash = target_content_hash;
  end if;
  return published;
end;
$$;

revoke all on function public.publish_candidate_intelligence_v2(
  uuid, uuid, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, text
) from public, anon;
grant execute on function public.publish_candidate_intelligence_v2(
  uuid, uuid, timestamptz, jsonb, jsonb, jsonb, jsonb, jsonb, text
) to authenticated, service_role;
