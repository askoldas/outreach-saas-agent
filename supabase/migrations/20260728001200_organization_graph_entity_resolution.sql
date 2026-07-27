-- Canonical organization graph and conservative entity resolution.
-- Apply after 20260728001100_semantic_discovery_coverage.sql.

alter table public.companies
  add column organization_type text not null default 'unknown'
    check (organization_type in (
      'company_group', 'operating_company', 'legal_entity', 'business_unit',
      'brand', 'branch', 'storefront', 'franchisee', 'franchisor',
      'association', 'public_institution', 'nonprofit', 'marketplace',
      'marketplace_seller', 'sole_trader', 'unknown'
    )),
  add column operating_status text not null default 'unknown'
    check (operating_status in (
      'active', 'inactive', 'dormant', 'closed', 'acquired', 'unknown'
    )),
  add column identity_confidence numeric(5,4) not null default 0
    check (identity_confidence between 0 and 1),
  add column identity_review_state text not null default 'unreviewed'
    check (identity_review_state in (
      'unreviewed', 'verified', 'needs_review', 'disputed', 'merged', 'archived'
    )),
  add column merged_into_company_id uuid
    references public.companies(id) on delete restrict,
  add constraint companies_cannot_merge_into_self
    check (merged_into_company_id is null or merged_into_company_id <> id);

create index companies_canonical_lookup_idx
on public.companies(workspace_id, normalized_name, country)
where merged_into_company_id is null;

alter table public.company_domains
  add column domain_role text not null default 'primary'
    check (domain_role in (
      'primary', 'localized', 'storefront', 'brand', 'redirect',
      'shared_directory', 'provider_hint'
    )),
  add column redirects_to_domain_id uuid
    references public.company_domains(id) on delete set null,
  add column evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  add constraint company_domain_cannot_redirect_to_self
    check (redirects_to_domain_id is null or redirects_to_domain_id <> id);

create table public.organization_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  alias_type text not null check (alias_type in (
    'legal_name', 'trade_name', 'brand_name', 'former_name', 'localized_name',
    'abbreviation', 'transliteration', 'provider_name', 'domain_derived_name',
    'user_confirmed_alias'
  )),
  alias text not null check (length(trim(alias)) > 0),
  normalized_alias text not null check (length(trim(normalized_alias)) > 0),
  country text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  created_at timestamptz not null default now(),
  unique (organization_id, alias_type, normalized_alias, country)
);

create table public.organization_identifiers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  identifier_type text not null,
  jurisdiction text not null default '',
  normalized_value text not null check (length(trim(normalized_value)) > 0),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'source_confirmed', 'verified', 'disputed')),
  source_record_id uuid references public.provider_source_records(id) on delete restrict,
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  created_at timestamptz not null default now(),
  unique (workspace_id, identifier_type, jurisdiction, normalized_value)
);

create table public.organization_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  location_type text not null check (location_type in (
    'registered', 'headquarters', 'operating', 'store', 'warehouse',
    'service_area', 'unknown'
  )),
  country text,
  region text,
  locality text,
  postal_code text,
  address_line text,
  normalized_address text,
  phone text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  created_at timestamptz not null default now()
);

create table public.organization_relationships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_organization_id uuid not null references public.companies(id) on delete cascade,
  target_organization_id uuid not null references public.companies(id) on delete cascade,
  relationship_type text not null check (relationship_type in (
    'owns', 'owned_by', 'controls', 'controlled_by', 'subsidiary_of',
    'parent_of', 'operates', 'operated_by', 'brand_of', 'owns_brand',
    'branch_of', 'has_branch', 'storefront_of', 'has_storefront',
    'franchisee_of', 'franchisor_of', 'business_unit_of', 'has_business_unit',
    'distributor_for', 'distributed_by', 'procures_for',
    'procurement_managed_by', 'shares_procurement_with', 'formerly_known_as',
    'successor_of', 'predecessor_of', 'related_company', 'possible_relation'
  )),
  status text not null default 'possible'
    check (status in ('current', 'historical', 'possible', 'rejected', 'superseded')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  valid_from date,
  valid_to date,
  created_by text not null check (created_by in ('provider', 'model', 'system', 'user')),
  model_version text,
  created_at timestamptz not null default now(),
  check (source_organization_id <> target_organization_id),
  check (valid_to is null or valid_from is null or valid_to >= valid_from),
  unique (
    source_organization_id, target_organization_id, relationship_type, status
  )
);

create table public.entity_resolution_cases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  normalized_candidate_id uuid not null
    references public.normalized_provider_candidates(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'needs_review', 'rejected', 'superseded')),
  rules_version text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (normalized_candidate_id, rules_version)
);

create table public.entity_match_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  resolution_case_id uuid not null
    references public.entity_resolution_cases(id) on delete cascade,
  candidate_organization_id uuid not null references public.companies(id) on delete cascade,
  signals_json jsonb not null check (jsonb_typeof(signals_json) = 'array'),
  aggregate_confidence numeric(5,4) not null
    check (aggregate_confidence between 0 and 1),
  contradiction_severity text not null
    check (contradiction_severity in ('none', 'low', 'medium', 'high')),
  recommendation text not null check (recommendation in (
    'auto_link', 'link_as_related_entity', 'create_new',
    'needs_review', 'reject_match'
  )),
  reasoning_summary text not null,
  rules_version text not null,
  model_version text,
  created_at timestamptz not null default now(),
  unique (resolution_case_id, candidate_organization_id, rules_version)
);

create table public.entity_resolution_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  resolution_case_id uuid not null
    references public.entity_resolution_cases(id) on delete cascade,
  normalized_candidate_id uuid not null
    references public.normalized_provider_candidates(id) on delete restrict,
  action text not null check (action in (
    'link_existing', 'create_new', 'create_related_node', 'merge',
    'reject_invalid', 'defer_review'
  )),
  target_organization_id uuid references public.companies(id) on delete restrict,
  related_organization_id uuid references public.companies(id) on delete restrict,
  relationship_type text,
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  reasoning_summary text not null,
  rules_version text not null,
  model_version text,
  decided_by text not null check (decided_by in ('rules', 'model', 'user', 'hybrid')),
  created_at timestamptz not null default now(),
  unique (resolution_case_id)
);

create table public.organization_source_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete restrict,
  provider_source_record_id uuid not null
    references public.provider_source_records(id) on delete restrict,
  normalized_candidate_id uuid
    references public.normalized_provider_candidates(id) on delete restrict,
  resolution_decision_id uuid
    references public.entity_resolution_decisions(id) on delete restrict,
  link_status text not null default 'active'
    check (link_status in ('active', 'possible_match', 'rejected', 'reassigned')),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  linked_at timestamptz not null default now(),
  unique (provider_source_record_id, organization_id)
);

create table public.organization_buying_hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  target_organization_id uuid not null references public.companies(id) on delete cascade,
  buying_organization_id uuid not null references public.companies(id) on delete cascade,
  procurement_autonomy text not null default 'unknown'
    check (procurement_autonomy in (
      'local', 'regional', 'centralized', 'shared', 'independent', 'unknown'
    )),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'rejected', 'superseded')),
  procurement_scope_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(procurement_scope_json) = 'object'),
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence_ids_json) = 'array'),
  reasoning_summary text not null default '',
  created_by text not null check (created_by in ('rules', 'model', 'user', 'hybrid')),
  created_at timestamptz not null default now()
);

create table public.organization_merge_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_organization_id uuid not null references public.companies(id) on delete restrict,
  target_organization_id uuid not null references public.companies(id) on delete restrict,
  resolution_decision_id uuid
    references public.entity_resolution_decisions(id) on delete restrict,
  merge_reason text not null,
  signals_json jsonb not null check (jsonb_typeof(signals_json) = 'array'),
  pre_merge_snapshot_json jsonb not null
    check (jsonb_typeof(pre_merge_snapshot_json) = 'object'),
  actor_type text not null check (actor_type in ('rules', 'system', 'user')),
  actor_id uuid,
  rules_version text not null,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  check (source_organization_id <> target_organization_id)
);

create unique index organization_merge_events_active_source_idx
on public.organization_merge_events(source_organization_id)
where reversed_at is null;

create table public.organization_split_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  merge_event_id uuid not null references public.organization_merge_events(id) on delete restrict,
  restored_organization_id uuid not null references public.companies(id) on delete restrict,
  reassignment_plan_json jsonb not null
    check (jsonb_typeof(reassignment_plan_json) = 'object'),
  split_reason text not null,
  actor_id uuid,
  created_at timestamptz not null default now(),
  unique (merge_event_id)
);

create or replace function public.validate_organization_graph_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name in (
    'organization_aliases', 'organization_identifiers',
    'organization_locations', 'organization_source_links'
  ) then
    select workspace_id into expected_workspace_id from public.companies
    where id = new.organization_id;
    if tg_table_name = 'organization_source_links' and not exists (
      select 1 from public.provider_source_records
      where id = new.provider_source_record_id
        and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace organization source link.'; end if;
  elsif tg_table_name = 'organization_relationships' then
    select workspace_id into expected_workspace_id from public.companies
    where id = new.source_organization_id;
    if not exists (
      select 1 from public.companies
      where id = new.target_organization_id and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace organization relationship.'; end if;
  elsif tg_table_name = 'organization_buying_hypotheses' then
    select workspace_id into expected_workspace_id from public.companies
    where id = new.target_organization_id;
    if not exists (
      select 1 from public.companies
      where id = new.buying_organization_id and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace buying organization.'; end if;
  elsif tg_table_name = 'organization_merge_events' then
    select workspace_id into expected_workspace_id from public.companies
    where id = new.source_organization_id;
    if not exists (
      select 1 from public.companies
      where id = new.target_organization_id and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace organization merge.'; end if;
  elsif tg_table_name = 'entity_resolution_cases' then
    select workspace_id into expected_workspace_id
    from public.normalized_provider_candidates
    where id = new.normalized_candidate_id;
  elsif tg_table_name = 'entity_match_assessments' then
    select workspace_id into expected_workspace_id
    from public.entity_resolution_cases where id = new.resolution_case_id;
    if not exists (
      select 1 from public.companies
      where id = new.candidate_organization_id
        and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace entity match assessment.'; end if;
  elsif tg_table_name = 'entity_resolution_decisions' then
    select workspace_id into expected_workspace_id
    from public.entity_resolution_cases where id = new.resolution_case_id;
    if not exists (
      select 1 from public.normalized_provider_candidates
      where id = new.normalized_candidate_id
        and workspace_id = expected_workspace_id
    ) then raise exception 'Cross-workspace entity resolution decision.'; end if;
  elsif tg_table_name = 'organization_split_events' then
    select workspace_id into expected_workspace_id
    from public.organization_merge_events where id = new.merge_event_id;
  else
    raise exception 'Unsupported organization graph workspace guard.';
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Organization graph workspace mismatch.';
  end if;
  return new;
end;
$$;

create trigger organization_relationships_workspace_guard
before insert or update on public.organization_relationships
for each row execute function public.validate_organization_graph_workspace();
create trigger organization_buying_hypotheses_workspace_guard
before insert or update on public.organization_buying_hypotheses
for each row execute function public.validate_organization_graph_workspace();
create trigger organization_merge_events_workspace_guard
before insert or update on public.organization_merge_events
for each row execute function public.validate_organization_graph_workspace();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organization_aliases', 'organization_identifiers', 'organization_locations',
    'organization_source_links', 'entity_resolution_cases',
    'entity_match_assessments', 'entity_resolution_decisions',
    'organization_split_events'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_organization_graph_workspace()',
      table_name || '_workspace_guard', table_name
    );
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'organization_aliases', 'organization_identifiers', 'organization_locations',
    'organization_relationships', 'organization_buying_hypotheses',
    'entity_resolution_cases', 'entity_match_assessments',
    'entity_resolution_decisions', 'organization_source_links',
    'organization_merge_events', 'organization_split_events'
  ] loop
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

create or replace function public.merge_organizations_v2(
  target_workspace_id uuid,
  source_organization_id uuid,
  target_organization_id uuid,
  merge_reason text,
  signals jsonb,
  rules_version text
)
returns public.organization_merge_events
language plpgsql security definer set search_path = public as $$
declare merge_event public.organization_merge_events;
declare source_company public.companies;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if source_organization_id = target_organization_id then
    raise exception 'An organization cannot be merged into itself.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    least(source_organization_id::text, target_organization_id::text) || ':' ||
    greatest(source_organization_id::text, target_organization_id::text), 0
  ));
  select * into source_company from public.companies
  where id = source_organization_id and workspace_id = target_workspace_id
  for update;
  if source_company.id is null or not exists (
    select 1 from public.companies
    where id = target_organization_id and workspace_id = target_workspace_id
      and merged_into_company_id is null
  ) then raise exception 'Canonical organizations not found.'; end if;
  if source_company.merged_into_company_id is not null then
    raise exception 'Source organization is already merged.';
  end if;
  if exists (
    with recursive redirects as (
      select id, merged_into_company_id from public.companies
      where id = target_organization_id
      union all
      select c.id, c.merged_into_company_id from public.companies c
      join redirects r on c.id = r.merged_into_company_id
    )
    select 1 from redirects where id = source_organization_id
  ) then raise exception 'Organization merge would create a redirect cycle.'; end if;
  insert into public.organization_merge_events (
    workspace_id, source_organization_id, target_organization_id,
    merge_reason, signals_json, pre_merge_snapshot_json,
    actor_type, actor_id, rules_version
  ) values (
    target_workspace_id, source_organization_id, target_organization_id,
    merge_reason, coalesce(signals, '[]'::jsonb), to_jsonb(source_company),
    'user', auth.uid(), rules_version
  ) returning * into merge_event;
  update public.companies set
    merged_into_company_id = target_organization_id,
    identity_review_state = 'merged',
    updated_at = now()
  where id = source_organization_id;
  return merge_event;
end;
$$;

create or replace function public.split_organization_merge_v2(
  target_workspace_id uuid,
  target_merge_event_id uuid,
  split_reason text,
  reassignment_plan jsonb default '{}'::jsonb
)
returns public.organization_split_events
language plpgsql security definer set search_path = public as $$
declare merge_event public.organization_merge_events;
declare split_event public.organization_split_events;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into merge_event from public.organization_merge_events
  where id = target_merge_event_id and workspace_id = target_workspace_id
  for update;
  if merge_event.id is null or merge_event.reversed_at is not null then
    raise exception 'Active merge event not found.';
  end if;
  if not exists (
    select 1 from public.companies
    where id = merge_event.source_organization_id
      and merged_into_company_id = merge_event.target_organization_id
  ) then raise exception 'Merge redirect has changed and cannot be reversed automatically.'; end if;
  update public.companies set
    merged_into_company_id = null,
    identity_review_state = 'needs_review',
    updated_at = now()
  where id = merge_event.source_organization_id;
  update public.organization_merge_events set reversed_at = now()
  where id = merge_event.id;
  insert into public.organization_split_events (
    workspace_id, merge_event_id, restored_organization_id,
    reassignment_plan_json, split_reason, actor_id
  ) values (
    target_workspace_id, merge_event.id, merge_event.source_organization_id,
    coalesce(reassignment_plan, '{}'::jsonb), split_reason, auth.uid()
  ) returning * into split_event;
  return split_event;
end;
$$;

revoke all on function public.merge_organizations_v2(
  uuid, uuid, uuid, text, jsonb, text
) from public, anon;
grant execute on function public.merge_organizations_v2(
  uuid, uuid, uuid, text, jsonb, text
) to authenticated, service_role;
revoke all on function public.split_organization_merge_v2(
  uuid, uuid, text, jsonb
) from public, anon;
grant execute on function public.split_organization_merge_v2(
  uuid, uuid, text, jsonb
) to authenticated, service_role;
