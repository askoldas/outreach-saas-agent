-- Comparative consistency and immutable ranking snapshots.
-- Apply after 20260728001400_candidate_qualification_v2.sql.

create table public.comparative_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  lane text not null check (lane in ('recommended','conditional','requires_research','rejected','excluded','invalid','duplicate')),
  batch_number integer not null check (batch_number > 0),
  status text not null default 'pending' check (status in ('pending','running','completed','anomalies_found','failed','superseded')),
  input_hash text not null check (length(input_hash) = 64),
  model_call_id uuid,
  rules_version text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (campaign_strategy_version_id, lane, batch_number, input_hash)
);

create table public.comparative_batch_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  comparative_batch_id uuid not null references public.comparative_batches(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete restrict,
  is_anchor boolean not null default false,
  deterministic_position integer not null check (deterministic_position > 0),
  comparative_position integer check (comparative_position is null or comparative_position > 0),
  created_at timestamptz not null default now(),
  unique (comparative_batch_id, campaign_candidate_id),
  unique (comparative_batch_id, deterministic_position)
);

create table public.comparative_anomalies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  comparative_batch_id uuid not null references public.comparative_batches(id) on delete cascade,
  anomaly_type text not null,
  candidate_ids_json jsonb not null check (jsonb_typeof(candidate_ids_json) = 'array'),
  factor_keys_json jsonb not null default '[]'::jsonb check (jsonb_typeof(factor_keys_json) = 'array'),
  severity text not null check (severity in ('low','medium','high')),
  explanation text not null,
  recommended_action text not null check (recommended_action in ('none','re_evaluate_factor','verify_relationship','verify_exclusion','verify_identity','merge_review','additional_research')),
  blocks_finalization boolean not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed','superseded')),
  resolution_json jsonb check (resolution_json is null or jsonb_typeof(resolution_json) = 'object'),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.candidate_rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  campaign_strategy_version_id uuid not null references public.campaign_strategy_versions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  ordering_policy_version text not null,
  included_evaluation_ids_json jsonb not null check (jsonb_typeof(included_evaluation_ids_json) = 'array'),
  comparative_batch_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(comparative_batch_ids_json) = 'array'),
  anomaly_resolution_ids_json jsonb not null default '[]'::jsonb check (jsonb_typeof(anomaly_resolution_ids_json) = 'array'),
  content_hash text not null check (length(content_hash) = 64),
  created_at timestamptz not null default now(),
  unique (campaign_id, campaign_strategy_version_id, version_number),
  unique (campaign_id, content_hash)
);

create table public.candidate_rank_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  rank_snapshot_id uuid not null references public.candidate_rank_snapshots(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete restrict,
  lane text not null,
  rank_overall integer not null check (rank_overall > 0),
  rank_within_lane integer not null check (rank_within_lane > 0),
  ordering_trace_json jsonb not null check (jsonb_typeof(ordering_trace_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (rank_snapshot_id, campaign_candidate_id),
  unique (rank_snapshot_id, rank_overall),
  unique (rank_snapshot_id, lane, rank_within_lane)
);

create table public.candidate_explanations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  summary text not null check (length(summary) between 1 and 1600),
  evidence_ids_json jsonb not null check (jsonb_typeof(evidence_ids_json) = 'array'),
  explanation_version text not null,
  created_at timestamptz not null default now(),
  unique (candidate_evaluation_version_id, explanation_version)
);

create table public.candidate_evaluation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  candidate_evaluation_version_id uuid not null references public.candidate_evaluation_versions(id) on delete cascade,
  event_type text not null,
  event_payload_json jsonb not null default '{}'::jsonb check (jsonb_typeof(event_payload_json) = 'object'),
  created_at timestamptz not null default now()
);

create or replace function public.validate_comparative_ranking_workspace()
returns trigger language plpgsql set search_path = public as $$
declare expected_workspace_id uuid;
begin
  if tg_table_name in ('comparative_batches','candidate_rank_snapshots') then
    select workspace_id into expected_workspace_id from public.campaigns where id = new.campaign_id;
  elsif tg_table_name in ('comparative_batch_members','comparative_anomalies') then
    select workspace_id into expected_workspace_id from public.comparative_batches where id = new.comparative_batch_id;
  elsif tg_table_name = 'candidate_rank_entries' then
    select workspace_id into expected_workspace_id from public.candidate_rank_snapshots where id = new.rank_snapshot_id;
  else
    select workspace_id into expected_workspace_id from public.candidate_evaluation_versions where id = new.candidate_evaluation_version_id;
  end if;
  if expected_workspace_id is null or expected_workspace_id <> new.workspace_id then raise exception 'Comparative ranking workspace mismatch.'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'comparative_batches','comparative_batch_members','comparative_anomalies',
    'candidate_rank_snapshots','candidate_rank_entries','candidate_explanations',
    'candidate_evaluation_events'
  ] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.validate_comparative_ranking_workspace()', table_name || '_workspace_guard', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_workspace_member(workspace_id))', 'Members can read ' || table_name, table_name);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id))', 'Admins can manage ' || table_name, table_name);
  end loop;
end;
$$;
