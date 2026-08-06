-- Scoped Intelligence Memory V2. Apply after 20260728000800.

create table public.intelligence_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  scope_type text not null
    check (scope_type in ('user', 'workspace', 'offering', 'campaign', 'candidate', 'run')),
  scope_id uuid not null,
  memory_type text not null check (memory_type in (
    'fact', 'preference', 'exclusion', 'correction', 'strategy_pattern',
    'market_finding', 'discovery_lesson', 'evaluation_lesson', 'hypothesis'
  )),
  statement text not null check (char_length(trim(statement)) between 1 and 1200),
  structured_value_json jsonb,
  applicability_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(applicability_json) = 'object'),
  applicability_known boolean not null default true,
  strength text not null check (strength in ('hard', 'soft')),
  status text not null default 'proposed' check (status in (
    'proposed', 'provisional', 'confirmed', 'rejected', 'superseded',
    'expired', 'archived'
  )),
  source text not null check (source in ('user', 'ai', 'system', 'import')),
  origin_type text not null,
  origin_id uuid,
  origin_campaign_id uuid references public.campaigns(id) on delete set null,
  origin_run_id uuid references public.campaign_runs(id) on delete set null,
  origin_candidate_id uuid references public.companies(id) on delete set null,
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  supersedes_memory_id uuid references public.intelligence_memories(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_applied_at timestamptz,
  expires_at timestamptz,
  check ((scope_type = 'user' and user_id = scope_id) or scope_type <> 'user'),
  unique (workspace_id, id)
);

create table public.memory_evidence_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null references public.intelligence_memories(id) on delete cascade,
  evidence_id uuid references public.evidence_items(id) on delete restrict,
  correction_id uuid,
  link_reason text not null default '',
  created_at timestamptz not null default now(),
  check (num_nonnulls(evidence_id, correction_id) = 1),
  unique nulls not distinct (memory_id, evidence_id, correction_id)
);

create table public.campaign_memory_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete restrict,
  snapshot_json jsonb not null check (jsonb_typeof(snapshot_json) = 'object'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique nulls not distinct (campaign_id, campaign_strategy_version_id, content_hash)
);

create table public.memory_application_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  memory_id uuid not null references public.intelligence_memories(id) on delete cascade,
  memory_snapshot_id uuid references public.campaign_memory_snapshots(id) on delete set null,
  applied_to_type text not null,
  applied_to_id uuid not null,
  application_reason text not null,
  result text not null check (result in ('applied', 'overridden', 'ignored', 'conflicted')),
  precedence_result_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(precedence_result_json) = 'object'),
  created_at timestamptz not null default now()
);

create table public.memory_promotion_proposals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_memory_id uuid not null references public.intelligence_memories(id) on delete restrict,
  source_memory_ids uuid[] not null default '{}',
  current_scope_type text not null check (current_scope_type in ('campaign', 'offering')),
  proposed_scope_type text not null check (proposed_scope_type in ('offering', 'workspace')),
  proposed_scope_id uuid not null,
  proposed_statement text not null check (length(trim(proposed_statement)) > 0),
  proposed_applicability_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(proposed_applicability_json) = 'object'),
  reason text not null,
  supporting_campaign_ids uuid[] not null default '{}',
  supporting_evidence_ids uuid[] not null default '{}',
  recurrence_count integer not null default 1 check (recurrence_count > 0),
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'deferred')),
  promoted_memory_id uuid references public.intelligence_memories(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by_user_id uuid references auth.users(id) on delete set null
);

create table public.intelligence_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  conflict_type text not null check (conflict_type in (
    'scope', 'value', 'applicability', 'freshness', 'authority', 'evidence'
  )),
  record_ids_json jsonb not null check (jsonb_typeof(record_ids_json) = 'array'),
  summary text not null,
  precedence_result_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(precedence_result_json) = 'object'),
  status text not null default 'unresolved'
    check (status in ('unresolved', 'resolved', 'user_required')),
  resolution text check (resolution in (
    'left_wins', 'right_wins', 'merged', 'unresolved', 'user_required'
  )),
  resolution_reason text,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.user_corrections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_run_id uuid references public.campaign_runs(id) on delete set null,
  candidate_id uuid references public.companies(id) on delete set null,
  correction_type text not null,
  target_type text not null,
  target_id uuid,
  previous_value_json jsonb,
  corrected_value_json jsonb not null,
  correction_statement text not null check (length(trim(correction_statement)) > 0),
  chosen_scope text not null default 'campaign'
    check (chosen_scope in ('campaign', 'offering', 'workspace', 'candidate')),
  immediate_action text not null,
  invalidation_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(invalidation_json) = 'object'),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.memory_evidence_links
add constraint memory_evidence_links_correction_fk
foreign key (correction_id) references public.user_corrections(id) on delete restrict;

create index intelligence_memories_retrieval_idx
on public.intelligence_memories(workspace_id, scope_type, scope_id, status, updated_at desc);
create index intelligence_memories_origin_idx
on public.intelligence_memories(workspace_id, origin_type, origin_id);
create index memory_application_events_target_idx
on public.memory_application_events(workspace_id, applied_to_type, applied_to_id, created_at desc);
create index memory_promotion_proposals_review_idx
on public.memory_promotion_proposals(workspace_id, status, created_at);
create index user_corrections_campaign_idx
on public.user_corrections(workspace_id, campaign_id, created_at desc);

create or replace function public.validate_intelligence_memory_scope()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if new.scope_type = 'workspace' then
    select id into expected_workspace_id from public.workspaces where id = new.scope_id;
  elsif new.scope_type = 'user' then
    if not exists (
      select 1 from public.workspace_members
      where workspace_id = new.workspace_id and user_id = new.scope_id and status = 'active'
    ) then raise exception 'Memory user is not an active workspace member.'; end if;
    expected_workspace_id := new.workspace_id;
  elsif new.scope_type = 'offering' then
    select workspace_id into expected_workspace_id from public.company_offerings where id = new.scope_id;
  elsif new.scope_type = 'campaign' then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.scope_id;
  elsif new.scope_type = 'candidate' then
    select workspace_id into expected_workspace_id from public.companies where id = new.scope_id;
  elsif new.scope_type = 'run' then
    select workspace_id into expected_workspace_id from public.campaign_runs where id = new.scope_id;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace or invalid Intelligence Memory scope.';
  end if;
  return new;
end;
$$;
create trigger intelligence_memories_scope_guard
before insert or update on public.intelligence_memories
for each row execute function public.validate_intelligence_memory_scope();

create or replace function public.validate_memory_child_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name in ('memory_evidence_links', 'memory_application_events') then
    select workspace_id into expected_workspace_id from public.intelligence_memories where id = new.memory_id;
  elsif tg_table_name = 'campaign_memory_snapshots' then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.campaign_id;
  elsif tg_table_name = 'memory_promotion_proposals' then
    select workspace_id into expected_workspace_id from public.intelligence_memories where id = new.source_memory_id;
  elsif tg_table_name = 'user_corrections' then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.campaign_id;
  else
    return new;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then
    raise exception 'Cross-workspace Intelligence Memory association.';
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'memory_evidence_links', 'campaign_memory_snapshots',
    'memory_application_events', 'memory_promotion_proposals', 'user_corrections'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.validate_memory_child_workspace()',
      table_name || '_workspace_guard', table_name
    );
  end loop;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'intelligence_memories', 'memory_evidence_links', 'campaign_memory_snapshots',
    'memory_application_events', 'memory_promotion_proposals',
    'intelligence_conflicts', 'user_corrections'
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

-- Historical memories are imported as explicitly scoped records with unknown
-- applicability. Approval and origin are preserved; no record becomes a global rule.
insert into public.intelligence_memories (
  workspace_id, scope_type, scope_id, memory_type, statement,
  applicability_json, applicability_known, strength, status, source, origin_type, origin_id,
  origin_campaign_id, origin_run_id, confidence, created_at, expires_at
)
select
  memory.workspace_id, 'campaign', memory.campaign_id,
  case when memory.category in (
    'fact', 'preference', 'exclusion', 'correction', 'strategy_pattern',
    'market_finding', 'discovery_lesson', 'evaluation_lesson', 'hypothesis'
  ) then memory.category else 'discovery_lesson' end,
  memory.statement, '{}'::jsonb, false,
  'soft',
  case memory.approval_status
    when 'approved' then 'confirmed'
    when 'rejected' then 'rejected'
    else 'proposed'
  end,
  'import', 'legacy_campaign_memory', memory.id,
  memory.campaign_id, memory.campaign_run_id,
  case memory.confidence when 'high' then 0.9 when 'medium' then 0.6 else 0.3 end,
  memory.created_at, memory.expires_at
from public.campaign_memories memory
where not exists (
  select 1 from public.intelligence_memories existing
  where existing.origin_type = 'legacy_campaign_memory' and existing.origin_id = memory.id
);

insert into public.intelligence_memories (
  workspace_id, scope_type, scope_id, memory_type, statement,
  applicability_json, applicability_known, strength, status, source, origin_type, origin_id,
  confidence, created_at, expires_at
)
select
  memory.workspace_id, 'workspace', memory.workspace_id,
  case when memory.category in (
    'fact', 'preference', 'exclusion', 'correction', 'strategy_pattern',
    'market_finding', 'discovery_lesson', 'evaluation_lesson', 'hypothesis'
  ) then memory.category else 'fact' end,
  memory.statement, '{}'::jsonb, false,
  'soft',
  case memory.approval_status
    when 'approved' then 'confirmed'
    when 'rejected' then 'rejected'
    else 'proposed'
  end,
  'import', 'legacy_workspace_memory', memory.id,
  case memory.confidence when 'high' then 0.9 when 'medium' then 0.6 else 0.3 end,
  memory.created_at, memory.expires_at
from public.workspace_memories memory
where not exists (
  select 1 from public.intelligence_memories existing
  where existing.origin_type = 'legacy_workspace_memory' and existing.origin_id = memory.id
);

revoke insert, update, delete on public.campaign_memories from authenticated;
revoke insert, update, delete on public.workspace_memories from authenticated;

create or replace function public.create_campaign_memory_snapshot(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_strategy_version_id uuid,
  target_snapshot jsonb,
  target_content_hash text
)
returns public.campaign_memory_snapshots
language plpgsql security definer set search_path = public as $$
declare saved public.campaign_memory_snapshots;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.campaigns
    where workspace_id = target_workspace_id and id = target_campaign_id
  ) then raise exception 'Campaign not found.'; end if;
  if target_strategy_version_id is not null and not exists (
    select 1 from public.campaign_strategy_versions
    where workspace_id = target_workspace_id and campaign_id = target_campaign_id
      and id = target_strategy_version_id
  ) then raise exception 'Strategy version does not belong to the Campaign.'; end if;
  insert into public.campaign_memory_snapshots (
    workspace_id, campaign_id, campaign_strategy_version_id, snapshot_json, content_hash
  ) values (
    target_workspace_id, target_campaign_id, target_strategy_version_id,
    target_snapshot, target_content_hash
  )
  on conflict (campaign_id, campaign_strategy_version_id, content_hash)
  do update set content_hash = public.campaign_memory_snapshots.content_hash
  returning * into saved;
  return saved;
end;
$$;

create or replace function public.record_campaign_memory_correction(
  target_workspace_id uuid,
  target_campaign_id uuid,
  target_correction_type text,
  target_statement text,
  target_previous_value jsonb,
  target_corrected_value jsonb,
  target_immediate_action text,
  target_applicability jsonb default '{}'::jsonb,
  target_proposed_offering_id uuid default null
)
returns public.intelligence_memories
language plpgsql security definer set search_path = public as $$
declare correction public.user_corrections;
declare saved_memory public.intelligence_memories;
declare recurrence integer;
declare recurring_memory_ids uuid[];
declare recurring_campaign_ids uuid[];
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.campaigns
    where workspace_id = target_workspace_id and id = target_campaign_id
  ) then raise exception 'Campaign not found.'; end if;
  insert into public.user_corrections (
    workspace_id, campaign_id, correction_type, target_type,
    previous_value_json, corrected_value_json, correction_statement,
    chosen_scope, immediate_action, created_by_user_id
  ) values (
    target_workspace_id, target_campaign_id, target_correction_type, 'campaign',
    target_previous_value, target_corrected_value, target_statement,
    'campaign', target_immediate_action, auth.uid()
  ) returning * into correction;
  insert into public.intelligence_memories (
    workspace_id, scope_type, scope_id, memory_type, statement,
    structured_value_json, applicability_json, strength, status, source,
    origin_type, origin_id, origin_campaign_id, confidence, created_by_user_id
  ) values (
    target_workspace_id, 'campaign', target_campaign_id, 'correction',
    target_statement, target_corrected_value, target_applicability,
    'hard', 'confirmed', 'user', 'user_correction', correction.id,
    target_campaign_id, 1, auth.uid()
  ) returning * into saved_memory;
  insert into public.memory_evidence_links (
    workspace_id, memory_id, correction_id, link_reason
  ) values (
    target_workspace_id, saved_memory.id, correction.id, 'Created by user correction'
  );
  select
    count(*),
    array_agg(id order by created_at),
    array_agg(distinct origin_campaign_id) filter (where origin_campaign_id is not null)
  into recurrence, recurring_memory_ids, recurring_campaign_ids
  from public.intelligence_memories
  where workspace_id = target_workspace_id and memory_type = 'correction'
    and status = 'confirmed' and statement = target_statement;
  if (target_proposed_offering_id is not null or recurrence >= 3) and not exists (
    select 1 from public.memory_promotion_proposals
    where workspace_id = target_workspace_id and status = 'pending'
      and proposed_scope_type =
        case when target_proposed_offering_id is null then 'workspace' else 'offering' end
      and proposed_scope_id = coalesce(target_proposed_offering_id, target_workspace_id)
      and proposed_statement = target_statement
  ) then
    insert into public.memory_promotion_proposals (
      workspace_id, source_memory_id, source_memory_ids, current_scope_type,
      proposed_scope_type, proposed_scope_id, proposed_statement,
      proposed_applicability_json, reason, supporting_campaign_ids,
      recurrence_count, confidence
    ) values (
      target_workspace_id, saved_memory.id, recurring_memory_ids, 'campaign',
      case when target_proposed_offering_id is null then 'workspace' else 'offering' end,
      coalesce(target_proposed_offering_id, target_workspace_id), target_statement,
      target_applicability,
      case when recurrence >= 3
        then 'The same confirmed correction recurred at least three times.'
        else 'The user requested broader applicability.'
      end,
      coalesce(recurring_campaign_ids, array[target_campaign_id]),
      greatest(recurrence, 1), 1
    );
  end if;
  return saved_memory;
end;
$$;

create or replace function public.resolve_memory_promotion_proposal(
  target_workspace_id uuid,
  target_proposal_id uuid,
  target_decision text
)
returns public.memory_promotion_proposals
language plpgsql security definer set search_path = public as $$
declare proposal public.memory_promotion_proposals;
declare source_memory public.intelligence_memories;
declare promoted public.intelligence_memories;
begin
  if not public.is_workspace_admin(target_workspace_id) then raise exception 'Forbidden'; end if;
  if target_decision not in ('accepted', 'rejected', 'deferred') then
    raise exception 'Unsupported promotion decision.';
  end if;
  select * into proposal from public.memory_promotion_proposals
  where workspace_id = target_workspace_id and id = target_proposal_id
    and status = 'pending' for update;
  if proposal.id is null then raise exception 'Pending promotion proposal not found.'; end if;
  if target_decision = 'accepted' then
    select * into source_memory from public.intelligence_memories
    where workspace_id = target_workspace_id and id = proposal.source_memory_id;
    insert into public.intelligence_memories (
      workspace_id, scope_type, scope_id, memory_type, statement,
      structured_value_json, applicability_json, strength, status, source,
      origin_type, origin_id, origin_campaign_id, confidence, created_by_user_id
    ) values (
      target_workspace_id, proposal.proposed_scope_type, proposal.proposed_scope_id,
      source_memory.memory_type, proposal.proposed_statement,
      source_memory.structured_value_json, proposal.proposed_applicability_json,
      source_memory.strength, 'confirmed', 'user', 'memory_promotion',
      proposal.id, source_memory.origin_campaign_id,
      proposal.confidence, auth.uid()
    ) returning * into promoted;
  end if;
  update public.memory_promotion_proposals set
    status = target_decision, promoted_memory_id = promoted.id,
    resolved_at = now(), resolved_by_user_id = auth.uid()
  where id = proposal.id returning * into proposal;
  return proposal;
end;
$$;

revoke all on function public.create_campaign_memory_snapshot(uuid,uuid,uuid,jsonb,text) from public, anon;
revoke all on function public.record_campaign_memory_correction(uuid,uuid,text,text,jsonb,jsonb,text,jsonb,uuid) from public, anon;
revoke all on function public.resolve_memory_promotion_proposal(uuid,uuid,text) from public, anon;
grant execute on function public.create_campaign_memory_snapshot(uuid,uuid,uuid,jsonb,text) to authenticated, service_role;
grant execute on function public.record_campaign_memory_correction(uuid,uuid,text,text,jsonb,jsonb,text,jsonb,uuid) to authenticated;
grant execute on function public.resolve_memory_promotion_proposal(uuid,uuid,text) to authenticated;
