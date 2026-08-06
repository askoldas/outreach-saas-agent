create table public.company_profile_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  base_version_id uuid references public.company_profile_versions(id) on delete restrict,
  state text not null default 'building'
    check (state in ('building', 'needs_input', 'ready_for_review', 'approved', 'abandoned', 'failed')),
  input_hash text not null check (length(trim(input_hash)) > 0),
  contract_version text not null default 'company-intelligence/v3.0',
  source_set_hash text,
  compiled_snapshot_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(compiled_snapshot_json) = 'object'),
  compiled_snapshot_hash text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_by_run_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (company_profile_id, input_hash)
);

alter table public.company_profiles
add column current_v3_draft_id uuid references public.company_profile_drafts(id) on delete set null;

create table public.company_business_models (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid references public.company_profile_drafts(id) on delete cascade,
  profile_version_id uuid references public.company_profile_versions(id) on delete restrict,
  primary_role text,
  revenue_model text,
  transaction_model text,
  customer_usage_mode text,
  sales_motion text,
  structured_details_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(structured_details_json) = 'object'),
  confidence numeric(5, 4) not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_draft_id, profile_version_id) = 1),
  unique nulls not distinct (profile_draft_id, profile_version_id)
);

create table public.company_business_roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  business_model_id uuid not null references public.company_business_models(id) on delete cascade,
  role_type text not null,
  priority text not null check (priority in ('primary', 'secondary', 'supporting')),
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  claim_id uuid references public.intelligence_claims(id) on delete restrict,
  explanation text not null default '',
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (business_model_id, role_type)
);

create table public.company_offerings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  stable_key text not null,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (company_profile_id, stable_key),
  unique (workspace_id, id)
);

create table public.company_offering_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_offering_id uuid not null references public.company_offerings(id) on delete cascade,
  profile_draft_id uuid references public.company_profile_drafts(id) on delete cascade,
  profile_version_id uuid references public.company_profile_versions(id) on delete restrict,
  slug text not null,
  name text not null,
  status text not null check (status in ('active', 'inactive', 'uncertain')),
  offering_type text not null,
  short_description text not null,
  commercial_mechanics_json jsonb not null default '{}'::jsonb,
  buyer_logic_json jsonb not null default '{}'::jsonb,
  relationship_options_json jsonb not null default '[]'::jsonb,
  availability_json jsonb not null default '{}'::jsonb,
  constraints_json jsonb not null default '[]'::jsonb,
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  claim_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_draft_id, profile_version_id) = 1),
  check (jsonb_typeof(commercial_mechanics_json) = 'object'),
  check (jsonb_typeof(buyer_logic_json) = 'object'),
  check (jsonb_typeof(relationship_options_json) = 'array'),
  check (jsonb_typeof(availability_json) = 'object'),
  check (jsonb_typeof(constraints_json) = 'array'),
  unique nulls not distinct (profile_draft_id, profile_version_id, slug)
);

create table public.buyer_archetype_hypotheses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid references public.company_profile_drafts(id) on delete cascade,
  profile_version_id uuid references public.company_profile_versions(id) on delete restrict,
  offering_version_id uuid not null references public.company_offering_versions(id) on delete cascade,
  archetype_key text not null,
  name text not null,
  relationship_type text not null,
  priority text not null check (priority in ('priority', 'conditional', 'low_priority', 'avoid')),
  status text not null check (status in ('proposed', 'user_confirmed', 'user_rejected', 'superseded')),
  structured_details_json jsonb not null default '{}'::jsonb,
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  claim_ids uuid[] not null default '{}',
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_draft_id, profile_version_id) = 1),
  unique nulls not distinct (profile_draft_id, profile_version_id, archetype_key)
);

create table public.commercial_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid references public.company_profile_drafts(id) on delete cascade,
  profile_version_id uuid references public.company_profile_versions(id) on delete restrict,
  rule_key text not null,
  scope text not null check (scope in ('workspace', 'offering')),
  scope_id uuid not null,
  rule_type text not null,
  strength text not null check (strength in ('hard', 'soft')),
  status text not null check (status in ('proposed', 'confirmed', 'rejected', 'superseded')),
  source text not null check (source in ('user', 'profile', 'ai', 'system', 'import')),
  description text not null,
  applicability_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(applicability_json) = 'object'),
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  evidence_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  check (num_nonnulls(profile_draft_id, profile_version_id) = 1),
  check (source <> 'ai' or status = 'proposed'),
  unique nulls not distinct (profile_draft_id, profile_version_id, rule_key)
);

create table public.profile_clarification_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid not null references public.company_profile_drafts(id) on delete cascade,
  question_key text not null,
  category text not null,
  question text not null,
  explanation text not null,
  answer_type text not null,
  options_json jsonb not null default '[]'::jsonb check (jsonb_typeof(options_json) = 'array'),
  impact text not null check (impact in ('blocking', 'important', 'optional')),
  affected_paths text[] not null default '{}',
  skip_allowed boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending', 'answered', 'skipped', 'obsolete')),
  answer_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_draft_id, question_key)
);

create table public.profile_task_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid not null references public.company_profile_drafts(id) on delete cascade,
  task_id text not null,
  idempotency_key text not null unique,
  input_hash text not null,
  contract_version text not null,
  prompt_version text not null,
  schema_version text not null,
  context_compiler_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'partial', 'skipped', 'blocked', 'failed')),
  output_json jsonb,
  output_hash text,
  warnings_json jsonb not null default '[]'::jsonb,
  ai_request_ids uuid[] not null default '{}',
  trigger_run_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (output_json is null or jsonb_typeof(output_json) in ('object', 'array')),
  check (jsonb_typeof(warnings_json) = 'array')
);

create table public.profile_change_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid not null references public.company_profile_drafts(id) on delete cascade,
  event_type text not null,
  actor_type text not null check (actor_type in ('user', 'ai', 'system', 'import')),
  actor_user_id uuid references auth.users(id) on delete set null,
  affected_paths text[] not null default '{}',
  details_json jsonb not null default '{}'::jsonb check (jsonb_typeof(details_json) = 'object'),
  created_at timestamptz not null default now()
);

create index company_profile_drafts_workspace_state_idx
on public.company_profile_drafts(workspace_id, state, updated_at desc);
create index profile_task_runs_draft_idx
on public.profile_task_runs(profile_draft_id, created_at);
create index profile_task_runs_status_idx
on public.profile_task_runs(workspace_id, status, updated_at);
create index company_offering_versions_draft_idx
on public.company_offering_versions(profile_draft_id, status);

create or replace function public.validate_company_v3_workspace()
returns trigger language plpgsql set search_path = public as $$
declare
  expected_workspace_id uuid;
begin
  if tg_table_name = 'company_profile_drafts' then
    select workspace_id into expected_workspace_id
    from public.company_profiles where id = new.company_profile_id;
  elsif tg_table_name = 'company_business_models' then
    select coalesce(d.workspace_id, v.workspace_id) into expected_workspace_id
    from (select 1) seed
    left join public.company_profile_drafts d on d.id = new.profile_draft_id
    left join public.company_profile_versions v on v.id = new.profile_version_id;
  elsif tg_table_name = 'company_offerings' then
    select workspace_id into expected_workspace_id
    from public.company_profiles where id = new.company_profile_id;
  else
    return new;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Company Intelligence V3 association.';
  end if;
  return new;
end;
$$;

create trigger company_profile_drafts_workspace_guard
before insert or update on public.company_profile_drafts
for each row execute function public.validate_company_v3_workspace();
create trigger company_business_models_workspace_guard
before insert or update on public.company_business_models
for each row execute function public.validate_company_v3_workspace();
create trigger company_offerings_workspace_guard
before insert or update on public.company_offerings
for each row execute function public.validate_company_v3_workspace();

create or replace function public.validate_company_v3_child_workspace()
returns trigger language plpgsql set search_path = public as $$
declare
  expected_workspace_id uuid;
begin
  if tg_table_name = 'company_business_roles' then
    select workspace_id into expected_workspace_id
    from public.company_business_models where id = new.business_model_id;
  elsif tg_table_name = 'company_offering_versions' then
    select workspace_id into expected_workspace_id
    from public.company_offerings where id = new.company_offering_id;
  elsif tg_table_name = 'buyer_archetype_hypotheses' then
    select workspace_id into expected_workspace_id
    from public.company_offering_versions where id = new.offering_version_id;
  elsif tg_table_name in (
    'profile_clarification_questions', 'profile_task_runs', 'profile_change_events'
  ) then
    select workspace_id into expected_workspace_id
    from public.company_profile_drafts where id = new.profile_draft_id;
  elsif tg_table_name = 'commercial_rules' then
    if new.profile_draft_id is not null then
      select workspace_id into expected_workspace_id
      from public.company_profile_drafts where id = new.profile_draft_id;
    else
      select workspace_id into expected_workspace_id
      from public.company_profile_versions where id = new.profile_version_id;
    end if;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Company Intelligence V3 child association.';
  end if;
  return new;
end;
$$;

create trigger company_business_roles_workspace_guard
before insert or update on public.company_business_roles
for each row execute function public.validate_company_v3_child_workspace();
create trigger company_offering_versions_workspace_guard
before insert or update on public.company_offering_versions
for each row execute function public.validate_company_v3_child_workspace();
create trigger buyer_archetype_hypotheses_workspace_guard
before insert or update on public.buyer_archetype_hypotheses
for each row execute function public.validate_company_v3_child_workspace();
create trigger commercial_rules_workspace_guard
before insert or update on public.commercial_rules
for each row execute function public.validate_company_v3_child_workspace();
create trigger profile_clarification_questions_workspace_guard
before insert or update on public.profile_clarification_questions
for each row execute function public.validate_company_v3_child_workspace();
create trigger profile_task_runs_workspace_guard
before insert or update on public.profile_task_runs
for each row execute function public.validate_company_v3_child_workspace();
create trigger profile_change_events_workspace_guard
before insert or update on public.profile_change_events
for each row execute function public.validate_company_v3_child_workspace();

create or replace function public.prevent_published_v3_child_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.profile_version_id is not null then
    raise exception 'Published Company Intelligence V3 records are immutable.';
  end if;
  return new;
end;
$$;

create trigger company_business_models_published_immutable
before update or delete on public.company_business_models
for each row execute function public.prevent_published_v3_child_mutation();
create trigger company_offering_versions_published_immutable
before update or delete on public.company_offering_versions
for each row execute function public.prevent_published_v3_child_mutation();
create trigger buyer_archetype_hypotheses_published_immutable
before update or delete on public.buyer_archetype_hypotheses
for each row execute function public.prevent_published_v3_child_mutation();
create trigger commercial_rules_published_immutable
before update or delete on public.commercial_rules
for each row execute function public.prevent_published_v3_child_mutation();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'company_profile_drafts', 'company_business_models', 'company_business_roles',
    'company_offerings', 'company_offering_versions', 'buyer_archetype_hypotheses',
    'commercial_rules', 'profile_clarification_questions', 'profile_task_runs',
    'profile_change_events'
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

create or replace function public.create_company_profile_v3_draft(
  target_workspace_id uuid,
  target_base_version_id uuid,
  target_input_hash text,
  target_snapshot jsonb,
  target_created_by uuid default auth.uid()
)
returns public.company_profile_drafts
language plpgsql security definer set search_path = public
as $$
declare
  profile_id uuid;
  result public.company_profile_drafts;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  select id into profile_id from public.company_profiles
  where workspace_id = target_workspace_id;
  if profile_id is null then raise exception 'Company Profile container is missing.'; end if;
  if target_base_version_id is not null and not exists (
    select 1 from public.company_profile_versions
    where id = target_base_version_id
      and company_profile_id = profile_id
      and workspace_id = target_workspace_id
  ) then
    raise exception 'Base profile version does not belong to this workspace profile.';
  end if;

  insert into public.company_profile_drafts (
    workspace_id, company_profile_id, base_version_id, input_hash,
    compiled_snapshot_json, created_by_user_id
  ) values (
    target_workspace_id, profile_id, target_base_version_id, target_input_hash,
    target_snapshot, target_created_by
  )
  on conflict (company_profile_id, input_hash) do update
  set updated_at = public.company_profile_drafts.updated_at
  returning * into result;

  update public.company_profiles set current_v3_draft_id = result.id
  where id = profile_id;
  return result;
end;
$$;

revoke all on function public.create_company_profile_v3_draft(
  uuid, uuid, text, jsonb, uuid
) from public, anon;
grant execute on function public.create_company_profile_v3_draft(
  uuid, uuid, text, jsonb, uuid
) to authenticated, service_role;
