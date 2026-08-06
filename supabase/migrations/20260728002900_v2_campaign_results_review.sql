-- WP-19: durable, auditable campaign-scoped review decisions and corrections.

create table public.candidate_review_decisions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  candidate_evaluation_version_id uuid not null
    references public.candidate_evaluation_versions(id) on delete cascade,
  decision text not null
    check (decision in ('approved', 'conditional', 'research_requested', 'rejected', 'excluded')),
  reason text not null default '',
  condition_text text,
  scope text not null default 'campaign' check (scope = 'campaign'),
  supersedes_decision_id uuid references public.candidate_review_decisions_v2(id),
  is_current boolean not null default true,
  decided_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create unique index candidate_review_decisions_v2_current_idx
on public.candidate_review_decisions_v2(campaign_run_id, campaign_candidate_id)
where is_current;

create index candidate_review_decisions_v2_workspace_run_idx
on public.candidate_review_decisions_v2(workspace_id, campaign_run_id, created_at desc);

create table public.candidate_corrections_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  campaign_candidate_id uuid not null references public.campaign_candidates(id) on delete cascade,
  candidate_evaluation_version_id uuid not null
    references public.candidate_evaluation_versions(id) on delete cascade,
  correction_type text not null
    check (correction_type in (
      'relationship', 'archetype', 'entity', 'evidence',
      'procurement', 'location', 'duplicate_state'
    )),
  proposed_value_json jsonb not null
    check (jsonb_typeof(proposed_value_json) = 'object'),
  reason text not null,
  scope text not null default 'campaign'
    check (scope in ('candidate', 'campaign', 'offering', 'workspace')),
  status text not null default 'proposed'
    check (status in ('proposed', 'applied', 'reverted')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id)
);

create index candidate_corrections_v2_workspace_run_idx
on public.candidate_corrections_v2(workspace_id, campaign_run_id, created_at desc);

alter table public.candidate_review_decisions_v2 enable row level security;
alter table public.candidate_corrections_v2 enable row level security;

create policy "Members can read candidate review decisions v2"
on public.candidate_review_decisions_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Admins can manage candidate review decisions v2"
on public.candidate_review_decisions_v2 for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Members can read candidate corrections v2"
on public.candidate_corrections_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Admins can manage candidate corrections v2"
on public.candidate_corrections_v2 for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create or replace function public.record_candidate_review_decision_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_campaign_candidate_id uuid,
  target_evaluation_version_id uuid,
  target_decision text,
  target_reason text default '',
  target_condition_text text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  previous_decision_id uuid;
  saved_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_decision not in (
    'approved', 'conditional', 'research_requested', 'rejected', 'excluded'
  ) then
    raise exception 'Invalid review decision';
  end if;
  if target_decision = 'conditional'
    and length(trim(coalesce(target_condition_text, ''))) = 0 then
    raise exception 'A conditional decision requires a condition';
  end if;
  if not exists (
    select 1
    from public.campaign_runs run
    join public.campaign_candidates candidate
      on candidate.campaign_id = run.campaign_id
      and candidate.workspace_id = run.workspace_id
    join public.candidate_evaluation_versions evaluation
      on evaluation.id = target_evaluation_version_id
      and evaluation.campaign_candidate_id = candidate.id
      and evaluation.workspace_id = run.workspace_id
    where run.id = target_campaign_run_id
      and run.workspace_id = target_workspace_id
      and candidate.id = target_campaign_candidate_id
  ) then
    raise exception 'Review target does not belong to this Campaign Run';
  end if;

  select id into previous_decision_id
  from public.candidate_review_decisions_v2
  where campaign_run_id = target_campaign_run_id
    and campaign_candidate_id = target_campaign_candidate_id
    and is_current
  for update;

  update public.candidate_review_decisions_v2
  set is_current = false
  where id = previous_decision_id;

  insert into public.candidate_review_decisions_v2 (
    workspace_id, campaign_run_id, campaign_candidate_id,
    candidate_evaluation_version_id, decision, reason, condition_text,
    supersedes_decision_id, decided_by
  ) values (
    target_workspace_id, target_campaign_run_id, target_campaign_candidate_id,
    target_evaluation_version_id, target_decision, trim(coalesce(target_reason, '')),
    nullif(trim(coalesce(target_condition_text, '')), ''),
    previous_decision_id, auth.uid()
  )
  returning id into saved_id;

  insert into public.candidate_evaluation_events (
    workspace_id, candidate_evaluation_version_id, event_type, event_payload_json
  ) values (
    target_workspace_id, target_evaluation_version_id, 'user_review_decision',
    jsonb_build_object(
      'reviewDecisionId', saved_id,
      'decision', target_decision,
      'scope', 'campaign'
    )
  );

  return saved_id;
end;
$$;

create or replace function public.propose_candidate_correction_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_campaign_candidate_id uuid,
  target_evaluation_version_id uuid,
  target_correction_type text,
  target_proposed_value_json jsonb,
  target_reason text,
  target_scope text default 'campaign'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  if target_correction_type not in (
    'relationship', 'archetype', 'entity', 'evidence',
    'procurement', 'location', 'duplicate_state'
  ) or target_scope not in ('candidate', 'campaign', 'offering', 'workspace')
    or jsonb_typeof(target_proposed_value_json) <> 'object'
    or length(trim(target_reason)) = 0 then
    raise exception 'Invalid correction proposal';
  end if;
  if not exists (
    select 1
    from public.campaign_runs run
    join public.campaign_candidates candidate
      on candidate.campaign_id = run.campaign_id
      and candidate.workspace_id = run.workspace_id
    join public.candidate_evaluation_versions evaluation
      on evaluation.id = target_evaluation_version_id
      and evaluation.campaign_candidate_id = candidate.id
      and evaluation.workspace_id = run.workspace_id
    where run.id = target_campaign_run_id
      and run.workspace_id = target_workspace_id
      and candidate.id = target_campaign_candidate_id
  ) then
    raise exception 'Correction target does not belong to this Campaign Run';
  end if;

  insert into public.candidate_corrections_v2 (
    workspace_id, campaign_run_id, campaign_candidate_id,
    candidate_evaluation_version_id, correction_type, proposed_value_json,
    reason, scope, created_by
  ) values (
    target_workspace_id, target_campaign_run_id, target_campaign_candidate_id,
    target_evaluation_version_id, target_correction_type,
    target_proposed_value_json, trim(target_reason), target_scope, auth.uid()
  )
  returning id into saved_id;

  insert into public.candidate_evaluation_events (
    workspace_id, candidate_evaluation_version_id, event_type, event_payload_json
  ) values (
    target_workspace_id, target_evaluation_version_id, 'user_correction_proposed',
    jsonb_build_object(
      'correctionId', saved_id,
      'correctionType', target_correction_type,
      'scope', target_scope
    )
  );

  return saved_id;
end;
$$;

revoke all on function public.record_candidate_review_decision_v2(
  uuid, uuid, uuid, uuid, text, text, text
) from public, anon;
revoke all on function public.propose_candidate_correction_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, text
) from public, anon;

grant execute on function public.record_candidate_review_decision_v2(
  uuid, uuid, uuid, uuid, text, text, text
) to authenticated;
grant execute on function public.propose_candidate_correction_v2(
  uuid, uuid, uuid, uuid, text, jsonb, text, text
) to authenticated;
