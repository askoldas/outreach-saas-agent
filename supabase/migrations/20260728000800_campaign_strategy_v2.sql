-- Campaign Strategy V2 persistence. Apply after 20260728000700.

create table public.campaign_inputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  geography_json jsonb not null check (jsonb_typeof(geography_json) = 'object'),
  objective_json jsonb not null check (jsonb_typeof(objective_json) = 'object'),
  offering_references_json jsonb not null check (jsonb_typeof(offering_references_json) = 'array'),
  offer_variant_json jsonb check (offer_variant_json is null or jsonb_typeof(offer_variant_json) = 'object'),
  constraints_json jsonb not null default '[]'::jsonb check (jsonb_typeof(constraints_json) = 'array'),
  initial_hypothesis_json jsonb not null default '{}'::jsonb check (jsonb_typeof(initial_hypothesis_json) = 'object'),
  requested_volume integer check (requested_volume is null or requested_volume > 0),
  input_hash text not null check (length(trim(input_hash)) = 64),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, input_hash),
  unique (workspace_id, id)
);

create table public.campaign_strategy_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_input_id uuid not null references public.campaign_inputs(id) on delete restrict,
  base_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete set null,
  profile_intelligence_version_id uuid not null references public.company_profile_versions(id) on delete restrict,
  state text not null default 'building'
    check (state in ('building', 'needs_input', 'ready_for_review', 'confirmed', 'abandoned', 'failed')),
  contract_version text not null default 'campaign-strategy/v2.0',
  context_compiler_version text not null default 'campaign-context/v2.0',
  compiler_version text not null default 'campaign-strategy/v2.0',
  compiled_context_json jsonb not null default '{}'::jsonb check (jsonb_typeof(compiled_context_json) = 'object'),
  compiled_context_hash text check (compiled_context_hash is null or length(compiled_context_hash) = 64),
  compiled_draft_json jsonb not null default '{}'::jsonb check (jsonb_typeof(compiled_draft_json) = 'object'),
  content_hash text check (content_hash is null or length(content_hash) = 64),
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (campaign_id, campaign_input_id, profile_intelligence_version_id, compiler_version)
);

alter table public.campaigns
add column current_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete set null;

alter table public.campaign_strategy_versions
add column contract_version text not null default 'campaign-strategy/v1.0',
add column scoring_version_id uuid references public.scoring_versions(id) on delete restrict,
add column profile_intelligence_version_id uuid references public.company_profile_versions(id) on delete restrict,
add column compiled_context_hash text,
add column content_hash text,
add column confirmation_status text not null default 'legacy'
  check (confirmation_status in ('legacy', 'pending', 'confirmed')),
add column confirmed_by uuid references auth.users(id) on delete set null,
add column confirmed_at timestamptz;

create table public.campaign_objectives (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  objective_json jsonb not null check (jsonb_typeof(objective_json) = 'object'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(campaign_strategy_draft_id, campaign_strategy_version_id) = 1)
);

create table public.campaign_buyer_archetypes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  archetype_key text not null,
  priority text not null check (priority in ('priority', 'conditional', 'exploratory', 'incompatible')),
  relationship_type text not null,
  archetype_json jsonb not null check (jsonb_typeof(archetype_json) = 'object'),
  user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  check (num_nonnulls(campaign_strategy_draft_id, campaign_strategy_version_id) = 1),
  unique nulls not distinct (campaign_strategy_draft_id, campaign_strategy_version_id, archetype_key)
);

create table public.campaign_qualification_rubrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  scoring_version_id uuid references public.scoring_versions(id) on delete restrict,
  policy_json jsonb not null check (jsonb_typeof(policy_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  check (num_nonnulls(campaign_strategy_draft_id, campaign_strategy_version_id) = 1),
  unique nulls not distinct (campaign_strategy_draft_id, campaign_strategy_version_id)
);

create table public.campaign_qualification_factor_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  qualification_rubric_id uuid not null references public.campaign_qualification_rubrics(id) on delete cascade,
  factor_key text not null,
  purpose text not null,
  weight numeric(7, 4) not null check (weight between 0 and 100),
  criticality text not null check (criticality in ('critical', 'important', 'supporting')),
  factor_json jsonb not null check (jsonb_typeof(factor_json) = 'object'),
  sort_order integer not null check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (qualification_rubric_id, factor_key)
);

create table public.campaign_rules_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  rule_key text not null,
  rule_type text not null,
  strength text not null check (strength in ('hard', 'soft')),
  status text not null check (status in ('proposed', 'provisional', 'confirmed', 'rejected', 'superseded')),
  rule_json jsonb not null check (jsonb_typeof(rule_json) = 'object'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(campaign_strategy_draft_id, campaign_strategy_version_id) = 1),
  unique nulls not distinct (campaign_strategy_draft_id, campaign_strategy_version_id, rule_key)
);

create table public.campaign_source_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  source_plan_json jsonb not null check (jsonb_typeof(source_plan_json) = 'object'),
  created_at timestamptz not null default now(),
  check (num_nonnulls(campaign_strategy_draft_id, campaign_strategy_version_id) = 1),
  unique nulls not distinct (campaign_strategy_draft_id, campaign_strategy_version_id)
);

create table public.campaign_market_findings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid not null references public.campaign_strategy_drafts(id) on delete cascade,
  finding_key text not null,
  finding_json jsonb not null check (jsonb_typeof(finding_json) = 'object'),
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (campaign_strategy_draft_id, finding_key)
);

create table public.campaign_strategy_diffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  from_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete restrict,
  to_strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete cascade,
  diff_json jsonb not null check (jsonb_typeof(diff_json) in ('object', 'array')),
  reevaluation_scope text not null default 'future_only'
    check (reevaluation_scope in ('all', 'affected', 'future_only', 'new_campaign')),
  created_at timestamptz not null default now()
);

create table public.campaign_strategy_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_draft_id uuid references public.campaign_strategy_drafts(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'ai', 'system', 'import')),
  actor_user_id uuid references auth.users(id) on delete set null,
  affected_paths text[] not null default '{}',
  details_json jsonb not null default '{}'::jsonb check (jsonb_typeof(details_json) = 'object'),
  created_at timestamptz not null default now()
);

create index campaign_strategy_drafts_state_idx
on public.campaign_strategy_drafts(workspace_id, state, updated_at desc);
create index campaign_buyer_archetypes_draft_idx
on public.campaign_buyer_archetypes(campaign_strategy_draft_id, priority);
create index campaign_strategy_events_campaign_idx
on public.campaign_strategy_events(workspace_id, campaign_id, created_at desc);
create unique index campaign_strategy_versions_one_active_v2_idx
on public.campaign_strategy_versions(campaign_id)
where confirmation_status = 'confirmed' and status = 'ready';

create or replace function public.prevent_confirmed_campaign_strategy_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.confirmation_status <> 'confirmed' then return new; end if;
  if new.strategy is distinct from old.strategy
    or new.contract_version is distinct from old.contract_version
    or new.profile_intelligence_version_id is distinct from old.profile_intelligence_version_id
    or new.compiled_context_hash is distinct from old.compiled_context_hash
    or new.content_hash is distinct from old.content_hash
    or new.confirmation_status is distinct from old.confirmation_status
    or new.confirmed_by is distinct from old.confirmed_by
    or new.confirmed_at is distinct from old.confirmed_at then
    raise exception 'Confirmed Campaign Strategy versions are immutable.';
  end if;
  return new;
end;
$$;
create trigger campaign_strategy_versions_v2_immutable
before update on public.campaign_strategy_versions
for each row execute function public.prevent_confirmed_campaign_strategy_mutation();

create or replace function public.validate_campaign_strategy_v2_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name in ('campaign_inputs', 'campaign_strategy_drafts', 'campaign_strategy_diffs', 'campaign_strategy_events') then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.campaign_id;
  elsif new.campaign_strategy_draft_id is not null then
    select workspace_id into expected_workspace_id from public.campaign_strategy_drafts where id = new.campaign_strategy_draft_id;
  elsif new.campaign_strategy_version_id is not null then
    select workspace_id into expected_workspace_id from public.campaign_strategy_versions where id = new.campaign_strategy_version_id;
  else
    return new;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Campaign Strategy V2 association.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'campaign_inputs', 'campaign_strategy_drafts', 'campaign_objectives',
    'campaign_buyer_archetypes', 'campaign_qualification_rubrics',
    'campaign_rules_v2', 'campaign_source_plans', 'campaign_market_findings',
    'campaign_strategy_diffs', 'campaign_strategy_events'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_campaign_strategy_v2_workspace()',
      table_name || '_workspace_guard', table_name
    );
  end loop;
end;
$$;

create or replace function public.validate_campaign_factor_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  select workspace_id into expected_workspace_id
  from public.campaign_qualification_rubrics where id = new.qualification_rubric_id;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace qualification factor association.';
  end if;
  return new;
end;
$$;
create trigger campaign_qualification_factors_workspace_guard
before insert or update on public.campaign_qualification_factor_definitions
for each row execute function public.validate_campaign_factor_workspace();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'campaign_inputs', 'campaign_strategy_drafts', 'campaign_objectives',
    'campaign_buyer_archetypes', 'campaign_qualification_rubrics',
    'campaign_qualification_factor_definitions', 'campaign_rules_v2',
    'campaign_source_plans', 'campaign_market_findings',
    'campaign_strategy_diffs', 'campaign_strategy_events'
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

create or replace function public.create_campaign_strategy_v2_draft(
  target_workspace_id uuid,
  target_campaign_external_id text,
  target_profile_version_id uuid,
  target_input jsonb,
  target_input_hash text,
  target_compiled_context jsonb,
  target_compiled_context_hash text
)
returns public.campaign_strategy_drafts
language plpgsql security definer set search_path = public as $$
declare target_campaign public.campaigns;
declare saved_input public.campaign_inputs;
declare saved_draft public.campaign_strategy_drafts;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into target_campaign from public.campaigns
  where workspace_id = target_workspace_id and external_id = target_campaign_external_id
  for update;
  if target_campaign.id is null then raise exception 'Campaign not found.'; end if;
  if not exists (
    select 1 from public.company_profile_versions
    where workspace_id = target_workspace_id and id = target_profile_version_id
      and profile_status = 'published' and intelligence_version = 'v2'
  ) then raise exception 'A published Company Intelligence V3 version is required.'; end if;

  insert into public.campaign_inputs (
    workspace_id, campaign_id, geography_json, objective_json,
    offering_references_json, offer_variant_json, constraints_json,
    initial_hypothesis_json, requested_volume, input_hash, created_by_user_id
  ) values (
    target_workspace_id, target_campaign.id, target_input->'geography',
    target_input->'objective', target_input->'offeringReferences',
    target_input->'offerVariant', coalesce(target_input->'constraints', '[]'::jsonb),
    coalesce(target_input->'initialHypothesis', '{}'::jsonb),
    nullif(target_input->>'requestedVolume', '')::integer, target_input_hash, auth.uid()
  )
  on conflict (campaign_id, input_hash) do update
  set updated_at = public.campaign_inputs.updated_at
  returning * into saved_input;

  insert into public.campaign_strategy_drafts (
    workspace_id, campaign_id, campaign_input_id, base_strategy_version_id,
    profile_intelligence_version_id, compiled_context_json,
    compiled_context_hash, created_by_user_id
  ) values (
    target_workspace_id, target_campaign.id, saved_input.id,
    target_campaign.current_strategy_version_id, target_profile_version_id,
    target_compiled_context, target_compiled_context_hash, auth.uid()
  )
  on conflict (campaign_id, campaign_input_id, profile_intelligence_version_id, compiler_version)
  do update set updated_at = public.campaign_strategy_drafts.updated_at
  returning * into saved_draft;

  update public.campaigns set current_strategy_draft_id = saved_draft.id, updated_at = now()
  where id = target_campaign.id;
  insert into public.campaign_strategy_events (
    workspace_id, campaign_id, campaign_strategy_draft_id, event_type,
    actor_type, actor_user_id, affected_paths, details_json
  ) values (
    target_workspace_id, target_campaign.id, saved_draft.id, 'draft_created',
    'user', auth.uid(), array['objective', 'geography', 'offeringReferences'],
    jsonb_build_object('inputHash', target_input_hash, 'contextHash', target_compiled_context_hash)
  );
  return saved_draft;
end;
$$;

create or replace function public.compile_campaign_strategy_v2_draft(
  target_workspace_id uuid,
  target_strategy_draft_id uuid,
  target_compilation jsonb
)
returns public.campaign_strategy_drafts
language plpgsql security definer set search_path = public as $$
declare draft_record public.campaign_strategy_drafts;
declare rubric_id uuid;
declare factor jsonb;
declare item jsonb;
declare factor_order integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into draft_record from public.campaign_strategy_drafts
  where workspace_id = target_workspace_id and id = target_strategy_draft_id for update;
  if draft_record.id is null then raise exception 'Campaign Strategy draft not found.'; end if;
  if draft_record.state not in ('building', 'needs_input', 'ready_for_review') then
    raise exception 'Campaign Strategy draft is not compilable.';
  end if;
  if target_compilation->>'compiledContextHash' <> draft_record.compiled_context_hash then
    raise exception 'Compiled campaign context changed.';
  end if;

  delete from public.campaign_objectives where campaign_strategy_draft_id = draft_record.id;
  delete from public.campaign_buyer_archetypes where campaign_strategy_draft_id = draft_record.id;
  delete from public.campaign_rules_v2 where campaign_strategy_draft_id = draft_record.id;
  delete from public.campaign_source_plans where campaign_strategy_draft_id = draft_record.id;
  delete from public.campaign_qualification_rubrics where campaign_strategy_draft_id = draft_record.id;

  insert into public.campaign_objectives (workspace_id, campaign_strategy_draft_id, objective_json)
  values (target_workspace_id, draft_record.id, target_compilation #> '{normalizedRecords,objective}');
  for item in select * from jsonb_array_elements(target_compilation #> '{normalizedRecords,archetypes}') loop
    insert into public.campaign_buyer_archetypes (
      workspace_id, campaign_strategy_draft_id, archetype_key, priority,
      relationship_type, archetype_json, user_confirmed
    ) values (
      target_workspace_id, draft_record.id, item->>'id', item->>'priority',
      item->>'relationshipType', item, coalesce((item->>'userConfirmed')::boolean, false)
    );
  end loop;
  insert into public.campaign_qualification_rubrics (
    workspace_id, campaign_strategy_draft_id, policy_json, content_hash
  ) values (
    target_workspace_id, draft_record.id,
    target_compilation #> '{normalizedRecords,qualificationPolicy}',
    encode(digest((target_compilation #> '{normalizedRecords,qualificationPolicy}')::text, 'sha256'), 'hex')
  ) returning id into rubric_id;
  for factor in select * from jsonb_array_elements(target_compilation #> '{normalizedRecords,qualificationPolicy,factorDefinitions}') loop
    insert into public.campaign_qualification_factor_definitions (
      workspace_id, qualification_rubric_id, factor_key, purpose, weight,
      criticality, factor_json, sort_order
    ) values (
      target_workspace_id, rubric_id, factor->>'factorKey',
      factor->>'definition', (factor->>'weight')::numeric,
      factor->>'criticality', factor, factor_order
    );
    factor_order := factor_order + 1;
  end loop;
  for item in select * from jsonb_array_elements(target_compilation #> '{normalizedRecords,campaignRules}') loop
    insert into public.campaign_rules_v2 (
      workspace_id, campaign_strategy_draft_id, rule_key, rule_type,
      strength, status, rule_json
    ) values (
      target_workspace_id, draft_record.id, item->>'ruleKey', item->>'ruleType',
      item->>'strength', item->>'status', item
    );
  end loop;
  insert into public.campaign_source_plans (
    workspace_id, campaign_strategy_draft_id, source_plan_json
  ) values (
    target_workspace_id, draft_record.id, target_compilation #> '{normalizedRecords,sourcePlan}'
  );
  update public.campaign_strategy_drafts set
    state = 'ready_for_review',
    compiled_draft_json = target_compilation->'strategy',
    content_hash = target_compilation->>'contentHash',
    compiler_version = target_compilation->>'compilerVersion',
    updated_at = now()
  where id = draft_record.id returning * into draft_record;
  insert into public.campaign_strategy_events (
    workspace_id, campaign_id, campaign_strategy_draft_id, event_type,
    actor_type, affected_paths, details_json
  ) values (
    target_workspace_id, draft_record.campaign_id, draft_record.id,
    'draft_compiled', 'system', array['strategy'],
    jsonb_build_object('contentHash', draft_record.content_hash)
  );
  return draft_record;
end;
$$;

create or replace function public.confirm_campaign_strategy_v2(
  target_workspace_id uuid,
  target_strategy_draft_id uuid
)
returns public.campaign_strategy_versions
language plpgsql security definer set search_path = public as $$
declare draft_record public.campaign_strategy_drafts;
declare saved_version public.campaign_strategy_versions;
declare next_version integer;
declare rubric_id uuid;
declare saved_version_id uuid := gen_random_uuid();
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  select * into draft_record from public.campaign_strategy_drafts
  where workspace_id = target_workspace_id and id = target_strategy_draft_id for update;
  if draft_record.id is null or draft_record.state <> 'ready_for_review' then
    raise exception 'Campaign Strategy draft is not ready for confirmation.';
  end if;
  if coalesce((draft_record.compiled_draft_json #>> '{objective,userConfirmed}')::boolean, false) is false
    or coalesce((draft_record.compiled_draft_json #>> '{geography,userConfirmed}')::boolean, false) is false then
    raise exception 'Objective and geography require explicit user confirmation.';
  end if;
  if draft_record.compiled_draft_json ? 'legacyImport' then
    raise exception 'Legacy strategy imports require review and recompilation.';
  end if;
  select coalesce(max(version), 0) + 1 into next_version
  from public.campaign_strategy_versions where campaign_id = draft_record.campaign_id;
  update public.campaign_strategy_versions set status = 'superseded'
  where campaign_id = draft_record.campaign_id and status = 'ready';
  insert into public.campaign_strategy_versions (
    id, workspace_id, campaign_id, version, status, strategy, created_by,
    contract_version, profile_intelligence_version_id, compiled_context_hash,
    content_hash, confirmation_status, confirmed_by, confirmed_at
  ) values (
    saved_version_id, target_workspace_id, draft_record.campaign_id, next_version, 'ready',
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(draft_record.compiled_draft_json, '{status}', '"confirmed"'::jsonb, true),
          '{id}', to_jsonb(saved_version_id::text), true
        ),
        '{versionNumber}', to_jsonb(next_version), true
      ),
      '{userConfirmation}', jsonb_build_object(
        'confirmed', true, 'confirmedByUserId', auth.uid(), 'confirmedAt', now()
      ), true
    ),
    auth.uid(), draft_record.contract_version,
    draft_record.profile_intelligence_version_id, draft_record.compiled_context_hash,
    draft_record.content_hash, 'confirmed', auth.uid(), now()
  ) returning * into saved_version;

  insert into public.campaign_objectives (
    workspace_id, campaign_strategy_version_id, objective_json
  ) select workspace_id, saved_version.id, objective_json
  from public.campaign_objectives where campaign_strategy_draft_id = draft_record.id;
  insert into public.campaign_buyer_archetypes (
    workspace_id, campaign_strategy_version_id, archetype_key, priority,
    relationship_type, archetype_json, user_confirmed
  ) select workspace_id, saved_version.id, archetype_key, priority,
    relationship_type, archetype_json, user_confirmed
  from public.campaign_buyer_archetypes where campaign_strategy_draft_id = draft_record.id;
  insert into public.campaign_rules_v2 (
    workspace_id, campaign_strategy_version_id, rule_key, rule_type,
    strength, status, rule_json
  ) select workspace_id, saved_version.id, rule_key, rule_type, strength,
    case when status = 'proposed' then 'provisional' else status end, rule_json
  from public.campaign_rules_v2 where campaign_strategy_draft_id = draft_record.id;
  insert into public.campaign_source_plans (
    workspace_id, campaign_strategy_version_id, source_plan_json
  ) select workspace_id, saved_version.id, source_plan_json
  from public.campaign_source_plans where campaign_strategy_draft_id = draft_record.id;
  insert into public.campaign_qualification_rubrics (
    workspace_id, campaign_strategy_version_id, scoring_version_id, policy_json, content_hash
  ) select workspace_id, saved_version.id, scoring_version_id, policy_json, content_hash
  from public.campaign_qualification_rubrics
  where campaign_strategy_draft_id = draft_record.id returning id into rubric_id;
  insert into public.campaign_qualification_factor_definitions (
    workspace_id, qualification_rubric_id, factor_key, purpose, weight,
    criticality, factor_json, sort_order
  ) select factor.workspace_id, rubric_id, factor.factor_key, factor.purpose,
    factor.weight, factor.criticality, factor.factor_json, factor.sort_order
  from public.campaign_qualification_factor_definitions factor
  join public.campaign_qualification_rubrics rubric
    on rubric.id = factor.qualification_rubric_id
  where rubric.campaign_strategy_draft_id = draft_record.id;

  update public.campaign_strategy_drafts set state = 'confirmed', updated_at = now()
  where id = draft_record.id;
  update public.campaigns set current_strategy_version_id = saved_version.id,
    current_strategy_draft_id = null, updated_at = now()
  where id = draft_record.campaign_id;
  insert into public.campaign_strategy_events (
    workspace_id, campaign_id, campaign_strategy_draft_id,
    campaign_strategy_version_id, event_type, actor_type, actor_user_id,
    affected_paths, details_json
  ) values (
    target_workspace_id, draft_record.campaign_id, draft_record.id,
    saved_version.id, 'strategy_confirmed', 'user', auth.uid(),
    array['strategy'], jsonb_build_object('version', next_version, 'contentHash', draft_record.content_hash)
  );
  return saved_version;
end;
$$;

revoke all on function public.create_campaign_strategy_v2_draft(uuid,text,uuid,jsonb,text,jsonb,text) from public, anon;
revoke all on function public.compile_campaign_strategy_v2_draft(uuid,uuid,jsonb) from public, anon;
revoke all on function public.confirm_campaign_strategy_v2(uuid,uuid) from public, anon;
grant execute on function public.create_campaign_strategy_v2_draft(uuid,text,uuid,jsonb,text,jsonb,text) to authenticated, service_role;
grant execute on function public.compile_campaign_strategy_v2_draft(uuid,uuid,jsonb) to authenticated, service_role;
grant execute on function public.confirm_campaign_strategy_v2(uuid,uuid) to authenticated;
