create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null check (length(trim(subject_type)) > 0),
  subject_id uuid not null,
  company_source_id uuid references public.company_sources(id) on delete restrict,
  document_chunk_id uuid references public.document_chunks(id) on delete restrict,
  provider_execution_id uuid references public.provider_executions(id) on delete restrict,
  manual_source_label text,
  evidence_type text not null check (length(trim(evidence_type)) > 0),
  structured_value_json jsonb,
  excerpt text check (excerpt is null or length(excerpt) <= 800),
  location_json jsonb not null default '{}'::jsonb
    check (jsonb_typeof(location_json) = 'object'),
  directness text not null
    check (directness in ('direct', 'indirect', 'reported', 'unknown')),
  source_reliability text not null
    check (source_reliability in (
      'first_party', 'authoritative_registry', 'trusted_directory',
      'reputable_secondary', 'unverified_secondary'
    )),
  freshness_state text not null
    check (freshness_state in ('current', 'recent', 'stale', 'unknown')),
  observed_at timestamptz,
  retrieved_at timestamptz not null,
  content_hash text not null check (length(trim(content_hash)) > 0),
  visibility text not null default 'workspace_private'
    check (visibility in ('public', 'workspace_private')),
  created_at timestamptz not null default now(),
  check (
    num_nonnulls(
      company_source_id,
      document_chunk_id,
      provider_execution_id,
      manual_source_label
    ) = 1
  ),
  check (manual_source_label is null or length(trim(manual_source_label)) > 0),
  unique (workspace_id, subject_type, subject_id, content_hash)
);

create table public.intelligence_claims (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null check (length(trim(subject_type)) > 0),
  subject_id uuid not null,
  claim_key text not null check (length(trim(claim_key)) > 0),
  field_path text not null check (length(trim(field_path)) > 0),
  statement text not null check (length(trim(statement)) between 1 and 1200),
  value_json jsonb,
  epistemic_status text not null check (epistemic_status in (
    'explicit_fact', 'evidence_backed_inference', 'hypothesis', 'unknown', 'conflict'
  )),
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active', 'user_confirmed', 'user_rejected', 'superseded')),
  confidence numeric(5, 4) not null check (confidence between 0 and 1),
  origin_type text not null
    check (origin_type in ('user', 'official_source', 'third_party_source', 'ai_inference', 'legacy_import', 'system')),
  origin_id uuid,
  concise_rationale text check (
    concise_rationale is null or length(concise_rationale) <= 600
  ),
  valid_from timestamptz,
  valid_to timestamptz,
  supersedes_claim_id uuid references public.intelligence_claims(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (
    epistemic_status <> 'unknown'
    or (value_json is null and confidence = 0)
  )
);

create table public.claim_evidence_links (
  claim_id uuid not null references public.intelligence_claims(id) on delete cascade,
  evidence_id uuid not null references public.evidence_items(id) on delete restrict,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  stance text not null check (stance in ('supports', 'contradicts', 'contextual')),
  weight numeric(5, 4) check (weight is null or weight between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (claim_id, evidence_id, stance)
);

create table public.claim_conflicts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  subject_type text not null,
  subject_id uuid not null,
  claim_key text not null,
  first_claim_id uuid not null references public.intelligence_claims(id) on delete restrict,
  second_claim_id uuid not null references public.intelligence_claims(id) on delete restrict,
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  resolution text,
  winning_claim_id uuid references public.intelligence_claims(id) on delete restrict,
  resolved_by_user_id uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (first_claim_id <> second_claim_id),
  check (
    (status = 'open' and resolved_at is null and resolved_by_user_id is null)
    or
    (status <> 'open' and resolved_at is not null and resolution is not null)
  ),
  unique (first_claim_id, second_claim_id)
);

create index evidence_items_subject_idx
on public.evidence_items(workspace_id, subject_type, subject_id, retrieved_at desc);
create index evidence_items_company_source_idx
on public.evidence_items(company_source_id) where company_source_id is not null;
create index intelligence_claims_subject_idx
on public.intelligence_claims(workspace_id, subject_type, subject_id, claim_key, created_at desc);
create index claim_evidence_links_evidence_idx
on public.claim_evidence_links(evidence_id);
create index claim_conflicts_open_idx
on public.claim_conflicts(workspace_id, subject_type, subject_id, status)
where status = 'open';
create unique index claim_conflicts_pair_idx
on public.claim_conflicts(
  least(first_claim_id, second_claim_id),
  greatest(first_claim_id, second_claim_id)
);

create or replace function public.prevent_evidence_claim_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  raise exception 'Evidence and claims are immutable; append or supersede records instead.';
end;
$$;

create trigger evidence_items_immutable
before update or delete on public.evidence_items
for each row execute function public.prevent_evidence_claim_mutation();
create trigger intelligence_claims_immutable
before update or delete on public.intelligence_claims
for each row execute function public.prevent_evidence_claim_mutation();
create trigger claim_evidence_links_immutable
before update or delete on public.claim_evidence_links
for each row execute function public.prevent_evidence_claim_mutation();

create or replace function public.validate_evidence_source_workspace()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.company_source_id is not null and not exists (
    select 1 from public.company_sources
    where id = new.company_source_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Company source must belong to the evidence workspace.';
  end if;
  if new.document_chunk_id is not null and not exists (
    select 1 from public.document_chunks
    where id = new.document_chunk_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Document chunk must belong to the evidence workspace.';
  end if;
  if new.provider_execution_id is not null and not exists (
    select 1 from public.provider_executions
    where id = new.provider_execution_id and workspace_id = new.workspace_id
  ) then
    raise exception 'Provider execution must belong to the evidence workspace.';
  end if;
  return new;
end;
$$;

create trigger evidence_items_workspace_guard
before insert on public.evidence_items
for each row execute function public.validate_evidence_source_workspace();

create or replace function public.validate_claim_evidence_link_workspace()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.intelligence_claims c
    join public.evidence_items e on e.id = new.evidence_id
    where c.id = new.claim_id
      and c.workspace_id = new.workspace_id
      and e.workspace_id = new.workspace_id
  ) then
    raise exception 'Claim and evidence must belong to the same workspace.';
  end if;
  return new;
end;
$$;

create trigger claim_evidence_links_workspace_guard
before insert on public.claim_evidence_links
for each row execute function public.validate_claim_evidence_link_workspace();

create or replace function public.validate_claim_conflict_workspace()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.intelligence_claims first_claim
    join public.intelligence_claims second_claim
      on second_claim.id = new.second_claim_id
    where first_claim.id = new.first_claim_id
      and first_claim.workspace_id = new.workspace_id
      and second_claim.workspace_id = new.workspace_id
      and first_claim.subject_type = new.subject_type
      and second_claim.subject_type = new.subject_type
      and first_claim.subject_id = new.subject_id
      and second_claim.subject_id = new.subject_id
      and first_claim.claim_key = new.claim_key
      and second_claim.claim_key = new.claim_key
  ) then
    raise exception 'Conflicting claims must share workspace, subject, and claim key.';
  end if;
  if new.winning_claim_id is not null
     and new.winning_claim_id not in (new.first_claim_id, new.second_claim_id) then
    raise exception 'Winning claim must be a member of the conflict.';
  end if;
  return new;
end;
$$;

create trigger claim_conflicts_workspace_guard
before insert or update on public.claim_conflicts
for each row execute function public.validate_claim_conflict_workspace();

create or replace function public.prevent_claim_conflict_identity_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.workspace_id <> old.workspace_id
     or new.subject_type <> old.subject_type
     or new.subject_id <> old.subject_id
     or new.claim_key <> old.claim_key
     or new.first_claim_id <> old.first_claim_id
     or new.second_claim_id <> old.second_claim_id
     or new.created_at <> old.created_at then
    raise exception 'Claim conflict identity is immutable.';
  end if;
  if old.status <> 'open' then
    raise exception 'Resolved claim conflicts are immutable.';
  end if;
  return new;
end;
$$;

create trigger claim_conflicts_identity_immutable
before update on public.claim_conflicts
for each row execute function public.prevent_claim_conflict_identity_mutation();

create or replace function public.create_intelligence_claim_with_evidence(
  target_claim_id uuid,
  target_workspace_id uuid,
  target_subject_type text,
  target_subject_id uuid,
  target_claim_key text,
  target_field_path text,
  target_statement text,
  target_value_json jsonb,
  target_epistemic_status text,
  target_confidence numeric,
  target_origin_type text,
  target_origin_id uuid,
  target_concise_rationale text,
  target_supersedes_claim_id uuid,
  evidence_links jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  evidence_link jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if jsonb_typeof(evidence_links) <> 'array' then
    raise exception 'Evidence links must be an array.';
  end if;
  if target_epistemic_status = 'explicit_fact' and not exists (
    select 1 from jsonb_array_elements(evidence_links) link
    where link->>'stance' = 'supports'
  ) then
    raise exception 'Explicit facts require supporting evidence.';
  end if;
  if target_epistemic_status = 'evidence_backed_inference'
     and nullif(trim(target_concise_rationale), '') is null then
    raise exception 'Evidence-backed inferences require a rationale.';
  end if;
  if target_epistemic_status = 'conflict'
     and not exists (
       select 1 from jsonb_array_elements(evidence_links) link
       where link->>'stance' = 'contradicts'
     )
     and nullif(trim(target_concise_rationale), '') is null then
    raise exception 'Conflicts require counter-evidence or a rationale.';
  end if;

  insert into public.intelligence_claims (
    id, workspace_id, subject_type, subject_id, claim_key, field_path, statement,
    value_json, epistemic_status, confidence, origin_type, origin_id,
    concise_rationale, supersedes_claim_id
  ) values (
    target_claim_id, target_workspace_id, target_subject_type, target_subject_id,
    target_claim_key, target_field_path, target_statement, target_value_json,
    target_epistemic_status, target_confidence, target_origin_type, target_origin_id,
    target_concise_rationale, target_supersedes_claim_id
  );

  for evidence_link in select value from jsonb_array_elements(evidence_links)
  loop
    insert into public.claim_evidence_links (
      claim_id, evidence_id, workspace_id, stance, weight
    ) values (
      target_claim_id,
      (evidence_link->>'evidenceId')::uuid,
      target_workspace_id,
      evidence_link->>'stance',
      nullif(evidence_link->>'weight', '')::numeric
    );
  end loop;

  return target_claim_id;
end;
$$;

alter table public.evidence_items enable row level security;
alter table public.intelligence_claims enable row level security;
alter table public.claim_evidence_links enable row level security;
alter table public.claim_conflicts enable row level security;

create policy "Members can read evidence items" on public.evidence_items
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Admins can create evidence items" on public.evidence_items
for insert to authenticated with check (public.is_workspace_admin(workspace_id));
create policy "Members can read intelligence claims" on public.intelligence_claims
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Admins can create intelligence claims" on public.intelligence_claims
for insert to authenticated with check (public.is_workspace_admin(workspace_id));
create policy "Members can read claim evidence links" on public.claim_evidence_links
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Admins can create claim evidence links" on public.claim_evidence_links
for insert to authenticated with check (public.is_workspace_admin(workspace_id));
create policy "Members can read claim conflicts" on public.claim_conflicts
for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "Admins can create claim conflicts" on public.claim_conflicts
for insert to authenticated with check (public.is_workspace_admin(workspace_id));
create policy "Admins can resolve claim conflicts" on public.claim_conflicts
for update to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

revoke insert, update, delete on public.intelligence_claims from authenticated;
revoke insert, update, delete on public.claim_evidence_links from authenticated;

revoke all on function public.create_intelligence_claim_with_evidence(
  uuid, uuid, text, uuid, text, text, text, jsonb, text, numeric, text, uuid,
  text, uuid, jsonb
) from public, anon;
grant execute on function public.create_intelligence_claim_with_evidence(
  uuid, uuid, text, uuid, text, text, text, jsonb, text, numeric, text, uuid,
  text, uuid, jsonb
) to authenticated, service_role;
