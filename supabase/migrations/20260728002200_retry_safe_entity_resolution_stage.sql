-- Retry-safe run-scoped candidate grouping and canonical entity resolution.
-- Apply after 20260728002100_targeted_semantic_discovery_passes.sql.

create table public.entity_resolution_batches_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  rules_version text not null check (length(trim(rules_version)) > 0),
  input_hash text not null check (length(input_hash) = 64),
  candidate_count integer not null check (candidate_count >= 0),
  status text not null check (status in ('running', 'completed')),
  summary_json jsonb check (
    summary_json is null or jsonb_typeof(summary_json) = 'object'
  ),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_run_id, rules_version)
);

create table public.discovery_candidate_groups_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  entity_resolution_batch_id uuid not null
    references public.entity_resolution_batches_v2(id) on delete cascade,
  group_key text not null check (length(trim(group_key)) > 0),
  grouping_basis text not null check (
    grouping_basis in ('domain', 'name_country', 'name', 'candidate')
  ),
  status text not null default 'provisional' check (
    status in ('provisional', 'resolved', 'split', 'needs_review', 'invalid')
  ),
  canonical_organization_id uuid references public.companies(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_run_id, group_key)
);

create table public.discovery_candidate_group_members_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_group_id uuid not null
    references public.discovery_candidate_groups_v2(id) on delete cascade,
  normalized_candidate_id uuid not null
    references public.normalized_provider_candidates(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (candidate_group_id, normalized_candidate_id),
  unique (normalized_candidate_id)
);

alter table public.entity_resolution_cases
  add column campaign_run_id uuid
    references public.campaign_runs(id) on delete cascade,
  add column entity_resolution_batch_id uuid
    references public.entity_resolution_batches_v2(id) on delete cascade,
  add column candidate_group_id uuid
    references public.discovery_candidate_groups_v2(id) on delete set null;

create index entity_resolution_batches_v2_workspace_idx
on public.entity_resolution_batches_v2(workspace_id, campaign_run_id, status);

create index discovery_candidate_groups_v2_run_idx
on public.discovery_candidate_groups_v2(
  workspace_id, campaign_run_id, status, group_key
);

create index entity_resolution_cases_campaign_run_idx
on public.entity_resolution_cases(
  workspace_id, campaign_run_id, status, normalized_candidate_id
);

create or replace function public.validate_entity_resolution_runtime_workspace_v2()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_workspace_id uuid;
  expected_campaign_id uuid;
  expected_campaign_run_id uuid;
  expected_batch_id uuid;
begin
  if tg_table_name = 'entity_resolution_batches_v2' then
    select workspace_id, campaign_id
    into expected_workspace_id, expected_campaign_id
    from public.campaign_runs
    where id = new.campaign_run_id
      and strategy_version_id = new.campaign_strategy_version_id
      and workflow_version = 'v2';
    if expected_campaign_id is distinct from new.campaign_id then
      raise exception 'Entity Resolution batch Campaign mismatch.';
    end if;
  elsif tg_table_name = 'discovery_candidate_groups_v2' then
    select workspace_id, campaign_run_id, campaign_id
    into expected_workspace_id, expected_campaign_run_id, expected_campaign_id
    from public.entity_resolution_batches_v2
    where id = new.entity_resolution_batch_id;
    if expected_campaign_run_id is distinct from new.campaign_run_id
      or expected_campaign_id is distinct from new.campaign_id
    then
      raise exception 'Candidate group batch mismatch.';
    end if;
    if new.canonical_organization_id is not null and not exists (
      select 1
      from public.companies
      where id = new.canonical_organization_id
        and workspace_id = expected_workspace_id
        and merged_into_company_id is null
    ) then
      raise exception 'Candidate group canonical organization mismatch.';
    end if;
  elsif tg_table_name = 'discovery_candidate_group_members_v2' then
    select workspace_id, campaign_run_id, campaign_id
    into expected_workspace_id, expected_campaign_run_id, expected_campaign_id
    from public.discovery_candidate_groups_v2
    where id = new.candidate_group_id;
    if not exists (
      select 1
      from public.normalized_provider_candidates candidate
      join public.provider_source_records source_record
        on source_record.id = candidate.provider_source_record_id
      join public.discovery_provider_executions provider_execution
        on provider_execution.id = source_record.provider_execution_id
      join public.discovery_segment_runs_v2 segment_run
        on segment_run.id = provider_execution.discovery_segment_run_id
      join public.discovery_runs_v2 discovery_run
        on discovery_run.id = segment_run.discovery_run_id
      where candidate.id = new.normalized_candidate_id
        and candidate.workspace_id = expected_workspace_id
        and candidate.campaign_id = expected_campaign_id
        and discovery_run.campaign_run_id = expected_campaign_run_id
    ) then
      raise exception 'Candidate group member Campaign Run mismatch.';
    end if;
  elsif tg_table_name = 'entity_resolution_cases' then
    if new.campaign_run_id is null then return new; end if;
    select workspace_id, campaign_id, id
    into expected_workspace_id, expected_campaign_id, expected_campaign_run_id
    from public.campaign_runs
    where id = new.campaign_run_id
      and workflow_version = 'v2';
    if new.entity_resolution_batch_id is null
      or new.candidate_group_id is null
      or not exists (
        select 1
        from public.entity_resolution_batches_v2 batch
        join public.discovery_candidate_groups_v2 candidate_group
          on candidate_group.id = new.candidate_group_id
          and candidate_group.entity_resolution_batch_id = batch.id
        join public.discovery_candidate_group_members_v2 member
          on member.candidate_group_id = candidate_group.id
          and member.normalized_candidate_id = new.normalized_candidate_id
        where batch.id = new.entity_resolution_batch_id
          and batch.campaign_run_id = new.campaign_run_id
          and batch.workspace_id = expected_workspace_id
      )
    then
      raise exception 'Entity Resolution case batch mismatch.';
    end if;
  else
    raise exception 'Unsupported Entity Resolution runtime workspace guard.';
  end if;

  if expected_workspace_id is null
    or expected_workspace_id <> new.workspace_id
  then
    raise exception 'Entity Resolution runtime workspace mismatch.';
  end if;
  return new;
end;
$$;

create trigger entity_resolution_batches_v2_workspace_guard
before insert or update on public.entity_resolution_batches_v2
for each row
execute function public.validate_entity_resolution_runtime_workspace_v2();

create trigger discovery_candidate_groups_v2_workspace_guard
before insert or update on public.discovery_candidate_groups_v2
for each row
execute function public.validate_entity_resolution_runtime_workspace_v2();

create trigger discovery_candidate_group_members_v2_workspace_guard
before insert or update on public.discovery_candidate_group_members_v2
for each row
execute function public.validate_entity_resolution_runtime_workspace_v2();

create trigger entity_resolution_cases_runtime_workspace_guard
before insert or update of
  campaign_run_id, entity_resolution_batch_id, candidate_group_id
on public.entity_resolution_cases
for each row
execute function public.validate_entity_resolution_runtime_workspace_v2();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'entity_resolution_batches_v2',
    'discovery_candidate_groups_v2',
    'discovery_candidate_group_members_v2'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))',
      'Members can read ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))',
      'Admins can manage ' || table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace function public.resolve_organization_redirect_v2(
  target_workspace_id uuid,
  target_organization_id uuid
)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  with recursive redirect_chain as (
    select organization.id, organization.merged_into_company_id
    from public.companies organization
    where organization.id = target_organization_id
      and organization.workspace_id = target_workspace_id

    union all

    select organization.id, organization.merged_into_company_id
    from public.companies organization
    join redirect_chain prior
      on organization.id = prior.merged_into_company_id
    where organization.workspace_id = target_workspace_id
  )
  select id
  from redirect_chain
  where merged_into_company_id is null
  limit 1;
$$;

create or replace function public.load_campaign_entity_resolution_inputs_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  discovery_run public.discovery_runs_v2;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2';
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into discovery_run
  from public.discovery_runs_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and status in ('completed', 'stopped_budget', 'stopped_user');
  if discovery_run.id is null then
    raise exception 'Completed Semantic Discovery Run not found.';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'normalizedCandidateId', candidate.id,
        'providerSourceRecordId', candidate.provider_source_record_id,
        'name', candidate.name,
        'normalizedName', candidate.normalized_name,
        'websiteUrl', candidate.website_url,
        'canonicalDomainHint', candidate.canonical_domain_hint,
        'sourceUrl', candidate.source_url,
        'country', candidate.country,
        'organizationTypeHint', candidate.organization_type_hint,
        'matchedSegmentKey', candidate.matched_segment_key,
        'matchedArchetypeKey', candidate.matched_archetype_key,
        'preliminaryQuality', candidate.preliminary_quality_json,
        'sourcePageType', source_record.raw_payload_json->>'pageType'
      )
      order by candidate.id
    )
    from public.normalized_provider_candidates candidate
    join public.provider_source_records source_record
      on source_record.id = candidate.provider_source_record_id
    join public.discovery_provider_executions provider_execution
      on provider_execution.id = source_record.provider_execution_id
    join public.discovery_segment_runs_v2 segment_run
      on segment_run.id = provider_execution.discovery_segment_run_id
    where segment_run.discovery_run_id = discovery_run.id
      and candidate.workspace_id = target_workspace_id
      and candidate.campaign_id = campaign_run.campaign_id
      and source_record.ingestion_status = 'normalized'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.resolve_campaign_entities_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_rules_version text,
  target_input_hash text,
  target_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  discovery_run public.discovery_runs_v2;
  saved_batch public.entity_resolution_batches_v2;
  saved_group public.discovery_candidate_groups_v2;
  saved_case public.entity_resolution_cases;
  saved_decision public.entity_resolution_decisions;
  saved_organization public.companies;
  saved_campaign_candidate public.campaign_candidates;
  candidate_record public.normalized_provider_candidates;
  source_record public.provider_source_records;
  prepared jsonb;
  candidate_id uuid;
  candidate_source_id uuid;
  candidate_name text;
  candidate_normalized_name text;
  candidate_country text;
  candidate_domain text;
  candidate_url text;
  candidate_type text;
  candidate_confidence numeric;
  candidate_group_key text;
  candidate_grouping_basis text;
  candidate_archetype_key text;
  candidate_segment_key text;
  invalid_identity boolean;
  safe_official_domain boolean;
  strong_match_ids uuid[];
  weak_match_ids uuid[];
  possible_match_ids uuid[];
  matched_organization_id uuid;
  assessment_organization_id uuid;
  match_organization public.companies;
  type_conflict boolean;
  decision_action text;
  decision_confidence numeric;
  decision_reason text;
  decision_ids uuid[] := '{}';
  campaign_candidate_ids uuid[] := '{}';
  group_ids uuid[] := '{}';
  database_candidate_count integer;
  supplied_candidate_count integer;
  group_resolved_count integer;
  group_review_count integer;
  group_invalid_count integer;
  group_organization_ids uuid[];
  summary jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if not exists (
    select 1
    from public.workspace_intelligence_settings rollout
    where rollout.workspace_id = target_workspace_id
      and rollout.campaign_workflow = 'v2'
      and rollout.result_write_mode = 'canonical'
      and rollout.shadow_mode = false
  ) then
    raise exception 'Canonical Intelligence V2 result writes are not enabled.';
  end if;
  if length(trim(target_rules_version)) = 0
    or length(target_input_hash) <> 64
    or jsonb_typeof(target_candidates) <> 'array'
  then
    raise exception 'Invalid Entity Resolution batch input.';
  end if;

  select * into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2'
  for update;
  if campaign_run.id is null then
    raise exception 'V2 Campaign Run not found.';
  end if;

  select * into discovery_run
  from public.discovery_runs_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and campaign_id = campaign_run.campaign_id
    and status in ('completed', 'stopped_budget', 'stopped_user')
  for update;
  if discovery_run.id is null then
    raise exception 'Completed Semantic Discovery Run not found.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_workspace_id::text || ':' ||
      target_campaign_run_id::text || ':' ||
      target_rules_version,
      0
    )
  );

  select * into saved_batch
  from public.entity_resolution_batches_v2
  where campaign_run_id = campaign_run.id
    and rules_version = target_rules_version
  for update;
  if saved_batch.id is not null then
    if saved_batch.input_hash <> target_input_hash then
      raise exception 'Entity Resolution batch input changed after it was frozen.';
    end if;
    if saved_batch.status <> 'completed' or saved_batch.summary_json is null then
      raise exception 'Entity Resolution batch is not replayable.';
    end if;
    return saved_batch.summary_json;
  end if;

  select count(distinct candidate.id)::integer
  into database_candidate_count
  from public.normalized_provider_candidates candidate
  join public.provider_source_records provider_source
    on provider_source.id = candidate.provider_source_record_id
  join public.discovery_provider_executions provider_execution
    on provider_execution.id = provider_source.provider_execution_id
  join public.discovery_segment_runs_v2 segment_run
    on segment_run.id = provider_execution.discovery_segment_run_id
  where segment_run.discovery_run_id = discovery_run.id
    and candidate.workspace_id = target_workspace_id
    and candidate.campaign_id = campaign_run.campaign_id;

  supplied_candidate_count := jsonb_array_length(target_candidates);
  if database_candidate_count <> supplied_candidate_count
    or (
      select count(distinct item->>'normalizedCandidateId')
      from jsonb_array_elements(target_candidates) item
    ) <> supplied_candidate_count
    or exists (
      select 1
      from jsonb_array_elements(target_candidates) item
      where not exists (
        select 1
        from public.normalized_provider_candidates candidate
        join public.provider_source_records provider_source
          on provider_source.id = candidate.provider_source_record_id
        join public.discovery_provider_executions provider_execution
          on provider_execution.id = provider_source.provider_execution_id
        join public.discovery_segment_runs_v2 segment_run
          on segment_run.id = provider_execution.discovery_segment_run_id
        where candidate.id = (item->>'normalizedCandidateId')::uuid
          and candidate.provider_source_record_id =
            (item->>'providerSourceRecordId')::uuid
          and candidate.workspace_id = target_workspace_id
          and candidate.campaign_id = campaign_run.campaign_id
          and segment_run.discovery_run_id = discovery_run.id
      )
    )
  then
    raise exception 'Entity Resolution candidate set does not match the frozen Discovery Run.';
  end if;

  insert into public.entity_resolution_batches_v2 (
    workspace_id,
    campaign_run_id,
    campaign_id,
    campaign_strategy_version_id,
    rules_version,
    input_hash,
    candidate_count,
    status
  ) values (
    target_workspace_id,
    campaign_run.id,
    campaign_run.campaign_id,
    campaign_run.strategy_version_id,
    target_rules_version,
    target_input_hash,
    supplied_candidate_count,
    'running'
  )
  returning * into saved_batch;

  for prepared in
    select item
    from jsonb_array_elements(target_candidates) item
    order by item->>'normalizedCandidateId'
  loop
    strong_match_ids := '{}';
    weak_match_ids := '{}';
    possible_match_ids := '{}';
    matched_organization_id := null;
    saved_decision := null;
    saved_organization := null;
    saved_campaign_candidate := null;

    candidate_id := (prepared->>'normalizedCandidateId')::uuid;
    candidate_source_id := (prepared->>'providerSourceRecordId')::uuid;
    candidate_name := trim(prepared->>'name');
    candidate_normalized_name := trim(prepared->>'normalizedName');
    candidate_country := nullif(upper(trim(prepared->>'country')), '');
    candidate_domain := nullif(lower(trim(prepared->>'canonicalDomain')), '');
    candidate_url := nullif(lower(trim(prepared->>'canonicalUrl')), '');
    candidate_type := coalesce(nullif(prepared->>'organizationType', ''), 'unknown');
    candidate_confidence := greatest(
      0,
      least(1, coalesce((prepared->>'confidence')::numeric, 0))
    );
    candidate_group_key := trim(prepared->>'groupKey');
    candidate_grouping_basis := prepared->>'groupingBasis';
    candidate_archetype_key := trim(prepared->>'matchedArchetypeKey');
    candidate_segment_key := trim(prepared->>'matchedSegmentKey');
    invalid_identity := coalesce((prepared->>'invalidIdentity')::boolean, false);
    safe_official_domain :=
      coalesce((prepared->>'safeOfficialDomain')::boolean, false);

    if candidate_name = ''
      or candidate_group_key = ''
      or candidate_archetype_key = ''
      or candidate_segment_key = ''
      or candidate_grouping_basis not in (
        'domain', 'name_country', 'name', 'candidate'
      )
      or candidate_type not in (
        'company_group', 'operating_company', 'legal_entity', 'business_unit',
        'brand', 'branch', 'storefront', 'franchisee', 'franchisor',
        'association', 'public_institution', 'nonprofit', 'marketplace',
        'marketplace_seller', 'sole_trader', 'unknown'
      )
      or (candidate_domain is not null and not safe_official_domain)
    then
      raise exception 'Prepared Entity Resolution candidate is invalid.';
    end if;

    select * into candidate_record
    from public.normalized_provider_candidates candidate
    where candidate.id = candidate_id
      and candidate.provider_source_record_id = candidate_source_id
      and candidate.workspace_id = target_workspace_id;
    select * into source_record
    from public.provider_source_records provider_source
    where provider_source.id = candidate_source_id
      and provider_source.workspace_id = target_workspace_id
      and provider_source.campaign_id = campaign_run.campaign_id;
    if candidate_record.id is null or source_record.id is null then
      raise exception 'Prepared Entity Resolution candidate disappeared.';
    end if;

    insert into public.discovery_candidate_groups_v2 (
      workspace_id,
      campaign_run_id,
      campaign_id,
      entity_resolution_batch_id,
      group_key,
      grouping_basis
    ) values (
      target_workspace_id,
      campaign_run.id,
      campaign_run.campaign_id,
      saved_batch.id,
      candidate_group_key,
      candidate_grouping_basis
    )
    on conflict (campaign_run_id, group_key)
    do update set group_key = excluded.group_key
    returning * into saved_group;

    if saved_group.entity_resolution_batch_id <> saved_batch.id
      or saved_group.grouping_basis <> candidate_grouping_basis
    then
      raise exception 'Candidate group identity changed after it was frozen.';
    end if;

    insert into public.discovery_candidate_group_members_v2 (
      workspace_id,
      candidate_group_id,
      normalized_candidate_id
    ) values (
      target_workspace_id,
      saved_group.id,
      candidate_id
    )
    on conflict (candidate_group_id, normalized_candidate_id) do nothing;

    insert into public.entity_resolution_cases (
      workspace_id,
      campaign_id,
      campaign_run_id,
      entity_resolution_batch_id,
      candidate_group_id,
      normalized_candidate_id,
      status,
      rules_version
    ) values (
      target_workspace_id,
      campaign_run.campaign_id,
      campaign_run.id,
      saved_batch.id,
      saved_group.id,
      candidate_id,
      'open',
      target_rules_version
    )
    on conflict (normalized_candidate_id, rules_version)
    do update set
      campaign_run_id = coalesce(
        public.entity_resolution_cases.campaign_run_id,
        excluded.campaign_run_id
      ),
      entity_resolution_batch_id = coalesce(
        public.entity_resolution_cases.entity_resolution_batch_id,
        excluded.entity_resolution_batch_id
      ),
      candidate_group_id = coalesce(
        public.entity_resolution_cases.candidate_group_id,
        excluded.candidate_group_id
      )
    returning * into saved_case;

    select * into saved_decision
    from public.entity_resolution_decisions
    where resolution_case_id = saved_case.id;

    if saved_decision.id is null then
      perform pg_advisory_xact_lock(
        hashtextextended(
          target_workspace_id::text || ':' ||
          coalesce(
            candidate_domain,
            candidate_normalized_name || ':' || coalesce(candidate_country, '')
          ),
          0
        )
      );

      select coalesce(array_agg(distinct organization_id order by organization_id), '{}')
      into strong_match_ids
      from (
        select public.resolve_organization_redirect_v2(
          target_workspace_id,
          linked_company.id
        ) as organization_id
        from public.organization_source_links source_link
        join public.companies linked_company
          on linked_company.id = source_link.organization_id
        where source_link.workspace_id = target_workspace_id
          and source_link.provider_source_record_id = candidate_source_id
          and source_link.link_status = 'active'
          and public.resolve_organization_redirect_v2(
            target_workspace_id,
            linked_company.id
          ) is not null

        union

        select public.resolve_organization_redirect_v2(
          target_workspace_id,
          domain_company.id
        )
        from public.company_domains company_domain
        join public.companies domain_company
          on domain_company.id = company_domain.company_id
        where safe_official_domain
          and candidate_domain is not null
          and company_domain.workspace_id = target_workspace_id
          and company_domain.normalized_domain = candidate_domain
          and company_domain.domain_role <> 'shared_directory'
          and company_domain.verification_status in ('source_confirmed', 'verified')
          and company_domain.collision_status in ('clear', 'resolved')
          and public.resolve_organization_redirect_v2(
            target_workspace_id,
            domain_company.id
          ) is not null

        union

        select public.resolve_organization_redirect_v2(
          target_workspace_id,
          website_company.id
        )
        from public.companies website_company
        where safe_official_domain
          and candidate_domain is not null
          and website_company.workspace_id = target_workspace_id
          and public.resolve_organization_redirect_v2(
            target_workspace_id,
            website_company.id
          ) is not null
          and lower(
            split_part(
              regexp_replace(
                website_company.website_url,
                '^https?://(www\.)?',
                '',
                'i'
              ),
              '/',
              1
            )
          ) = candidate_domain
      ) deterministic_matches;

      select coalesce(array_agg(distinct organization_id order by organization_id), '{}')
      into weak_match_ids
      from (
        select public.resolve_organization_redirect_v2(
          target_workspace_id,
          weak_company.id
        ) as organization_id
        from public.companies weak_company
        where weak_company.workspace_id = target_workspace_id
          and candidate_normalized_name <> ''
          and weak_company.normalized_name = candidate_normalized_name
          and (
            candidate_country is null
            or upper(coalesce(weak_company.country, '')) = candidate_country
          )

        union

        select public.resolve_organization_redirect_v2(
          target_workspace_id,
          collision_company.id
        )
        from public.company_domains collision_domain
        join public.companies collision_company
          on collision_company.id = collision_domain.company_id
        where safe_official_domain
          and candidate_domain is not null
          and collision_domain.workspace_id = target_workspace_id
          and collision_domain.normalized_domain = candidate_domain
          and public.resolve_organization_redirect_v2(
            target_workspace_id,
            collision_company.id
          ) is not null
      ) possible_matches;

      strong_match_ids := coalesce(strong_match_ids, '{}');
      weak_match_ids := coalesce(weak_match_ids, '{}');
      possible_match_ids := case
        when cardinality(strong_match_ids) > 0 then strong_match_ids
        else weak_match_ids
      end;

      if invalid_identity then
        decision_action := 'reject_invalid';
        decision_confidence := 1;
        decision_reason :=
          'The normalized record is a directory/container or has no usable identity.';
        matched_organization_id := null;
      elsif cardinality(strong_match_ids) = 1 then
        matched_organization_id := strong_match_ids[1];
        select * into match_organization
        from public.companies
        where id = matched_organization_id
          and workspace_id = target_workspace_id
          and merged_into_company_id is null;
        type_conflict :=
          candidate_type <> 'unknown'
          and match_organization.organization_type <> 'unknown'
          and candidate_type <> match_organization.organization_type;
        if type_conflict then
          decision_action := 'defer_review';
          decision_confidence := 0.98;
          decision_reason :=
            'An exact identity key points to an incompatible organization type.';
          matched_organization_id := null;
        else
          decision_action := 'link_existing';
          decision_confidence := 0.98;
          decision_reason :=
            'One deterministic source, official-domain, or canonical-URL match was found.';
        end if;
      elsif cardinality(strong_match_ids) > 1 then
        decision_action := 'defer_review';
        decision_confidence := 0;
        decision_reason :=
          'Several canonical organizations share deterministic identity evidence.';
        matched_organization_id := null;
      elsif cardinality(weak_match_ids) > 0 then
        decision_action := 'defer_review';
        decision_confidence := 0.8;
        decision_reason :=
          'Name, country, or an ambiguous domain suggests a possible match but cannot auto-link.';
        matched_organization_id := null;
      else
        decision_action := 'create_new';
        decision_confidence := greatest(
          0.4,
          case when safe_official_domain then 0.85 else candidate_confidence end
        );
        decision_reason :=
          'No existing canonical organization has reliable matching identity evidence.';

        insert into public.companies (
          workspace_id,
          name,
          normalized_name,
          website_url,
          country,
          city,
          description,
          organization_type,
          operating_status,
          identity_confidence,
          identity_review_state,
          metadata
        ) values (
          target_workspace_id,
          candidate_name,
          candidate_normalized_name,
          case
            when safe_official_domain and candidate_domain is not null
              then 'https://' || candidate_domain || '/'
            else null
          end,
          candidate_country,
          candidate_record.locality,
          coalesce(candidate_record.description, ''),
          candidate_type,
          'unknown',
          decision_confidence,
          'unreviewed',
          jsonb_build_object(
            'origin', 'entity_resolution_v2',
            'normalizedCandidateId', candidate_id,
            'rulesVersion', target_rules_version
          )
        )
        returning * into saved_organization;
        matched_organization_id := saved_organization.id;

        insert into public.organization_aliases (
          workspace_id,
          organization_id,
          alias_type,
          alias,
          normalized_alias,
          country,
          confidence
        ) values (
          target_workspace_id,
          saved_organization.id,
          'provider_name',
          candidate_name,
          candidate_normalized_name,
          candidate_country,
          decision_confidence
        )
        on conflict (
          organization_id, alias_type, normalized_alias, country
        ) do nothing;

        if safe_official_domain and candidate_domain is not null then
          insert into public.company_domains (
            workspace_id,
            company_id,
            domain,
            normalized_domain,
            is_primary,
            verification_status,
            collision_status,
            domain_role,
            metadata
          ) values (
            target_workspace_id,
            saved_organization.id,
            candidate_domain,
            candidate_domain,
            true,
            'source_confirmed',
            'clear',
            'primary',
            jsonb_build_object(
              'normalizedCandidateId', candidate_id,
              'rulesVersion', target_rules_version
            )
          );
        end if;
      end if;

      foreach assessment_organization_id in array possible_match_ids loop
        select * into match_organization
        from public.companies
        where id = assessment_organization_id
          and workspace_id = target_workspace_id;
        type_conflict :=
          candidate_type <> 'unknown'
          and match_organization.organization_type <> 'unknown'
          and candidate_type <> match_organization.organization_type;

        insert into public.entity_match_assessments (
          workspace_id,
          resolution_case_id,
          candidate_organization_id,
          signals_json,
          aggregate_confidence,
          contradiction_severity,
          recommendation,
          reasoning_summary,
          rules_version
        ) values (
          target_workspace_id,
          saved_case.id,
          assessment_organization_id,
          case
            when assessment_organization_id = any(strong_match_ids) then
              jsonb_build_array(jsonb_build_object(
                'key', 'deterministic_exact_identity',
                'category', 'provider_mapping',
                'state', 'match',
                'weight', 1,
                'confidence', 0.98,
                'evidenceIds', jsonb_build_array(candidate_source_id),
                'explanation',
                  'A prior source link, verified official domain, or canonical URL matches.'
              ))
            else
              jsonb_build_array(jsonb_build_object(
                'key',
                  case when candidate_country is null
                    then 'normalized_name'
                    else 'normalized_name_country'
                  end,
                'category', 'name',
                'state', 'partial_match',
                'weight', 0.55,
                'confidence', 0.8,
                'evidenceIds', jsonb_build_array(candidate_source_id),
                'explanation',
                  'A normalized name and optional country match requires review.'
              ))
          end ||
          case when type_conflict then
            jsonb_build_array(jsonb_build_object(
              'key', 'incompatible_entity_types',
              'category', 'contradiction',
              'state', 'conflict',
              'weight', 1,
              'confidence', 1,
              'evidenceIds', jsonb_build_array(candidate_source_id),
              'explanation',
                'Distinct entity types cannot be silently collapsed.'
            ))
          else '[]'::jsonb end,
          case
            when assessment_organization_id = any(strong_match_ids) then 0.98
            else 0.8
          end,
          case when type_conflict then 'high' else 'none' end,
          case
            when type_conflict then 'link_as_related_entity'
            when assessment_organization_id = any(strong_match_ids)
              and cardinality(strong_match_ids) = 1 then 'auto_link'
            else 'needs_review'
          end,
          case
            when type_conflict then
              'Identity evidence conflicts with the existing organization type.'
            when assessment_organization_id = any(strong_match_ids) then
              'Deterministic identity evidence was found.'
            else
              'Weak identity evidence is retained for explicit review.'
          end,
          target_rules_version
        )
        on conflict (
          resolution_case_id, candidate_organization_id, rules_version
        ) do nothing;
      end loop;

      insert into public.entity_resolution_decisions (
        workspace_id,
        resolution_case_id,
        normalized_candidate_id,
        action,
        target_organization_id,
        confidence,
        evidence_ids_json,
        reasoning_summary,
        rules_version,
        decided_by
      ) values (
        target_workspace_id,
        saved_case.id,
        candidate_id,
        decision_action,
        matched_organization_id,
        decision_confidence,
        jsonb_build_array(candidate_source_id),
        decision_reason,
        target_rules_version,
        'rules'
      )
      returning * into saved_decision;

      update public.entity_resolution_cases
      set
        status = case
          when decision_action = 'defer_review' then 'needs_review'
          when decision_action = 'reject_invalid' then 'rejected'
          else 'resolved'
        end,
        resolved_at = case
          when decision_action = 'defer_review' then null
          else now()
        end
      where id = saved_case.id
      returning * into saved_case;
    else
      decision_action := saved_decision.action;
      matched_organization_id := saved_decision.target_organization_id;
      if saved_case.entity_resolution_batch_id <> saved_batch.id
        or saved_case.candidate_group_id <> saved_group.id
      then
        raise exception 'Existing Entity Resolution decision belongs to another batch.';
      end if;
    end if;

    decision_ids := array_append(decision_ids, saved_decision.id);

    if decision_action in ('link_existing', 'create_new')
      and matched_organization_id is not null
    then
      insert into public.organization_source_links (
        workspace_id,
        organization_id,
        provider_source_record_id,
        normalized_candidate_id,
        resolution_decision_id,
        link_status,
        confidence
      ) values (
        target_workspace_id,
        matched_organization_id,
        candidate_source_id,
        candidate_id,
        saved_decision.id,
        'active',
        saved_decision.confidence
      )
      on conflict (provider_source_record_id, organization_id)
      do update set
        normalized_candidate_id = excluded.normalized_candidate_id,
        resolution_decision_id = excluded.resolution_decision_id,
        link_status = 'active',
        confidence = greatest(
          public.organization_source_links.confidence,
          excluded.confidence
        );

      insert into public.campaign_candidates (
        workspace_id,
        campaign_id,
        organization_id,
        buying_organization_id,
        display_organization_id,
        campaign_strategy_version_id,
        state,
        matched_archetype_ids_json,
        discovered_country
      ) values (
        target_workspace_id,
        campaign_run.campaign_id,
        matched_organization_id,
        matched_organization_id,
        matched_organization_id,
        campaign_run.strategy_version_id,
        'discovered',
        jsonb_build_array(candidate_archetype_key),
        candidate_country
      )
      on conflict (
        campaign_id, organization_id, campaign_strategy_version_id
      )
      do update set
        discovered_country = coalesce(
          public.campaign_candidates.discovered_country,
          excluded.discovered_country
        ),
        updated_at = now()
      returning * into saved_campaign_candidate;

      update public.campaign_candidates
      set matched_archetype_ids_json = (
        select coalesce(jsonb_agg(to_jsonb(value) order by value), '[]'::jsonb)
        from (
          select distinct value
          from jsonb_array_elements_text(
            public.campaign_candidates.matched_archetype_ids_json ||
            jsonb_build_array(candidate_archetype_key)
          ) item(value)
        ) unique_values
      )
      where id = saved_campaign_candidate.id
      returning * into saved_campaign_candidate;

      campaign_candidate_ids :=
        array_append(campaign_candidate_ids, saved_campaign_candidate.id);

      insert into public.campaign_candidate_discovery_links (
        workspace_id,
        campaign_candidate_id,
        normalized_candidate_id,
        provider_source_record_id,
        discovery_segment_key
      ) values (
        target_workspace_id,
        saved_campaign_candidate.id,
        candidate_id,
        candidate_source_id,
        candidate_segment_key
      )
      on conflict (
        campaign_candidate_id,
        normalized_candidate_id,
        provider_source_record_id,
        discovery_segment_key
      ) do nothing;
    elsif decision_action = 'defer_review' then
      foreach assessment_organization_id in array possible_match_ids loop
        insert into public.organization_source_links (
          workspace_id,
          organization_id,
          provider_source_record_id,
          normalized_candidate_id,
          resolution_decision_id,
          link_status,
          confidence
        ) values (
          target_workspace_id,
          assessment_organization_id,
          candidate_source_id,
          candidate_id,
          saved_decision.id,
          'possible_match',
          case
            when assessment_organization_id = any(strong_match_ids) then 0.98
            else 0.8
          end
        )
        on conflict (provider_source_record_id, organization_id)
        do update set
          normalized_candidate_id = excluded.normalized_candidate_id,
          resolution_decision_id = excluded.resolution_decision_id,
          link_status = case
            when public.organization_source_links.link_status = 'active'
              then 'active'
            else 'possible_match'
          end,
          confidence = greatest(
            public.organization_source_links.confidence,
            excluded.confidence
          );
      end loop;
    end if;
  end loop;

  for saved_group in
    select *
    from public.discovery_candidate_groups_v2
    where entity_resolution_batch_id = saved_batch.id
    order by group_key
  loop
    select
      count(*) filter (
        where decision.action in ('link_existing', 'create_new')
      )::integer,
      count(*) filter (
        where decision.action = 'defer_review'
      )::integer,
      count(*) filter (
        where decision.action = 'reject_invalid'
      )::integer,
      coalesce(
        array_agg(distinct decision.target_organization_id)
          filter (where decision.target_organization_id is not null),
        '{}'
      )
    into
      group_resolved_count,
      group_review_count,
      group_invalid_count,
      group_organization_ids
    from public.discovery_candidate_group_members_v2 member
    join public.entity_resolution_cases resolution_case
      on resolution_case.normalized_candidate_id = member.normalized_candidate_id
      and resolution_case.rules_version = target_rules_version
    join public.entity_resolution_decisions decision
      on decision.resolution_case_id = resolution_case.id
    where member.candidate_group_id = saved_group.id;

    update public.discovery_candidate_groups_v2
    set
      status = case
        when group_review_count > 0 then 'needs_review'
        when group_invalid_count > 0 and group_resolved_count = 0 then 'invalid'
        when cardinality(group_organization_ids) = 1 then 'resolved'
        else 'split'
      end,
      canonical_organization_id = case
        when cardinality(group_organization_ids) = 1
          then group_organization_ids[1]
        else null
      end,
      updated_at = now()
    where id = saved_group.id;

    group_ids := array_append(group_ids, saved_group.id);
  end loop;

  select jsonb_build_object(
    'schemaVersion', 2,
    'batchId', saved_batch.id,
    'campaignRunId', campaign_run.id,
    'rulesVersion', target_rules_version,
    'inputHash', target_input_hash,
    'candidateCount', saved_batch.candidate_count,
    'groupCount', (
      select count(*)::integer
      from public.discovery_candidate_groups_v2
      where entity_resolution_batch_id = saved_batch.id
    ),
    'canonicalOrganizations', (
      select count(distinct target_organization_id)::integer
      from public.entity_resolution_decisions decision
      join public.entity_resolution_cases resolution_case
        on resolution_case.id = decision.resolution_case_id
      where resolution_case.entity_resolution_batch_id = saved_batch.id
        and decision.target_organization_id is not null
    ),
    'organizationsCreated', (
      select count(*)::integer
      from public.entity_resolution_decisions decision
      join public.entity_resolution_cases resolution_case
        on resolution_case.id = decision.resolution_case_id
      where resolution_case.entity_resolution_batch_id = saved_batch.id
        and decision.action = 'create_new'
    ),
    'linkedExisting', (
      select count(*)::integer
      from public.entity_resolution_decisions decision
      join public.entity_resolution_cases resolution_case
        on resolution_case.id = decision.resolution_case_id
      where resolution_case.entity_resolution_batch_id = saved_batch.id
        and decision.action = 'link_existing'
    ),
    'needsReview', (
      select count(*)::integer
      from public.entity_resolution_decisions decision
      join public.entity_resolution_cases resolution_case
        on resolution_case.id = decision.resolution_case_id
      where resolution_case.entity_resolution_batch_id = saved_batch.id
        and decision.action = 'defer_review'
    ),
    'invalidEntities', (
      select count(*)::integer
      from public.entity_resolution_decisions decision
      join public.entity_resolution_cases resolution_case
        on resolution_case.id = decision.resolution_case_id
      where resolution_case.entity_resolution_batch_id = saved_batch.id
        and decision.action = 'reject_invalid'
    ),
    'campaignCandidateCount', (
      select count(distinct campaign_candidate.id)::integer
      from public.campaign_candidates campaign_candidate
      where campaign_candidate.workspace_id = target_workspace_id
        and campaign_candidate.campaign_id = campaign_run.campaign_id
        and campaign_candidate.campaign_strategy_version_id =
          campaign_run.strategy_version_id
        and campaign_candidate.id = any(campaign_candidate_ids)
    ),
    'sourceLinkCount', (
      select count(*)::integer
      from public.organization_source_links source_link
      where source_link.resolution_decision_id = any(decision_ids)
    ),
    'duplicatesOrMergedEntities', greatest(
      0,
      (
        select count(*)::integer
        from public.entity_resolution_decisions decision
        join public.entity_resolution_cases resolution_case
          on resolution_case.id = decision.resolution_case_id
        where resolution_case.entity_resolution_batch_id = saved_batch.id
          and decision.target_organization_id is not null
      ) - (
        select count(distinct target_organization_id)::integer
        from public.entity_resolution_decisions decision
        join public.entity_resolution_cases resolution_case
          on resolution_case.id = decision.resolution_case_id
        where resolution_case.entity_resolution_batch_id = saved_batch.id
          and decision.target_organization_id is not null
      )
    ),
    'resolutionDecisionIds', to_jsonb(
      coalesce((
        select array_agg(distinct value order by value)
        from unnest(decision_ids) item(value)
      ), '{}')
    ),
    'campaignCandidateIds', to_jsonb(
      coalesce((
        select array_agg(distinct value order by value)
        from unnest(campaign_candidate_ids) item(value)
      ), '{}')
    ),
    'groupIds', to_jsonb(coalesce(group_ids, '{}'))
  )
  into summary;

  update public.entity_resolution_batches_v2
  set
    status = 'completed',
    summary_json = summary,
    completed_at = now()
  where id = saved_batch.id
  returning * into saved_batch;

  update public.discovery_runs_v2
  set usage_summary_json =
    coalesce(usage_summary_json, '{}'::jsonb) ||
    jsonb_build_object(
      'uniqueCandidateGroups', (summary->>'groupCount')::integer,
      'canonicalOrganizations', (summary->>'canonicalOrganizations')::integer,
      'invalidEntities',
        coalesce((usage_summary_json->>'invalidEntities')::integer, 0) +
        (summary->>'invalidEntities')::integer,
      'duplicatesOrMergedEntities',
        (summary->>'duplicatesOrMergedEntities')::integer
    )
  where id = discovery_run.id
    and workspace_id = target_workspace_id;

  return summary;
end;
$$;

revoke all on function public.load_campaign_entity_resolution_inputs_v2(
  uuid, uuid
) from public, anon, authenticated;

revoke all on function public.resolve_organization_redirect_v2(
  uuid, uuid
) from public, anon, authenticated;

revoke all on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.load_campaign_entity_resolution_inputs_v2(
  uuid, uuid
) to service_role;

grant execute on function public.resolve_organization_redirect_v2(
  uuid, uuid
) to service_role;

grant execute on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
) to service_role;
