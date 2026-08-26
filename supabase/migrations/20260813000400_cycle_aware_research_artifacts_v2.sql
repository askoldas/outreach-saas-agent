-- Make repeatable Candidate Research, Qualification, and Ranking artifacts addressable
-- by immutable Campaign Research cycle while preserving every existing row as cycle 1.

alter table public.candidate_research_batches_v2
  add column research_cycle_id uuid
    references public.campaign_research_cycles_v2(id) on delete cascade;
alter table public.candidate_qualification_batches_v2
  add column research_cycle_id uuid
    references public.campaign_research_cycles_v2(id) on delete cascade;
alter table public.comparative_batches
  add column research_cycle_id uuid
    references public.campaign_research_cycles_v2(id) on delete cascade;
alter table public.candidate_rank_snapshots
  add column research_cycle_id uuid
    references public.campaign_research_cycles_v2(id) on delete cascade;

insert into public.campaign_research_cycles_v2 (
  workspace_id, campaign_id, campaign_run_id, cycle_number, status,
  budget_json, usage_json, started_at, completed_at
)
select
  run.workspace_id, run.campaign_id, run.id, 1, 'complete',
  jsonb_build_object(
    'maxProviderCalls', 30,
    'maxAiCostUsd', 2,
    'maxAiTokens', 500000,
    'maxDeepResearchCandidates', 40,
    'maxRuntimeMinutes', 45
  ),
  '{}'::jsonb,
  run.created_at,
  coalesce(run.completed_at, now())
from public.campaign_runs run
where run.workflow_version = 'v2'
  and (
    exists (select 1 from public.candidate_research_batches_v2 item where item.campaign_run_id = run.id)
    or exists (select 1 from public.candidate_qualification_batches_v2 item where item.campaign_run_id = run.id)
    or exists (select 1 from public.candidate_rank_snapshots item where item.campaign_run_id = run.id)
  )
on conflict (campaign_run_id, cycle_number) do nothing;

update public.candidate_research_batches_v2 batch
set research_cycle_id = cycle.id
from public.campaign_research_cycles_v2 cycle
where cycle.campaign_run_id = batch.campaign_run_id and cycle.cycle_number = 1;
update public.candidate_qualification_batches_v2 batch
set research_cycle_id = cycle.id
from public.campaign_research_cycles_v2 cycle
where cycle.campaign_run_id = batch.campaign_run_id and cycle.cycle_number = 1;
update public.comparative_batches batch
set research_cycle_id = cycle.id
from public.campaign_research_cycles_v2 cycle
where cycle.campaign_run_id = batch.campaign_run_id and cycle.cycle_number = 1
  and batch.campaign_run_id is not null;
update public.candidate_rank_snapshots snapshot
set research_cycle_id = cycle.id
from public.campaign_research_cycles_v2 cycle
where cycle.campaign_run_id = snapshot.campaign_run_id and cycle.cycle_number = 1
  and snapshot.campaign_run_id is not null;

do $$
begin
  if exists (select 1 from public.candidate_research_batches_v2 where research_cycle_id is null)
    or exists (select 1 from public.candidate_qualification_batches_v2 where research_cycle_id is null)
    or exists (select 1 from public.comparative_batches where campaign_run_id is not null and research_cycle_id is null)
    or exists (select 1 from public.candidate_rank_snapshots where campaign_run_id is not null and research_cycle_id is null)
  then
    raise exception 'Every existing V2 repeatable artifact requires a cycle-1 parent.';
  end if;
end;
$$;

alter table public.candidate_research_batches_v2 alter column research_cycle_id set not null;
alter table public.candidate_qualification_batches_v2 alter column research_cycle_id set not null;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid in (
      'public.candidate_research_batches_v2'::regclass,
      'public.candidate_qualification_batches_v2'::regclass
    )
      and constraint_row.contype = 'u'
      and pg_get_constraintdef(constraint_row.oid) in (
        'UNIQUE (campaign_run_id)',
        'UNIQUE (campaign_run_id, input_hash)'
      )
  loop
    if constraint_name is not null then
      execute format('alter table %s drop constraint %I',
        case when exists (
          select 1 from pg_constraint located
          where located.conname = constraint_name
            and located.conrelid = 'public.candidate_research_batches_v2'::regclass
        ) then 'public.candidate_research_batches_v2'
        else 'public.candidate_qualification_batches_v2' end,
        constraint_name);
    end if;
  end loop;
end;
$$;

drop index if exists public.comparative_batches_v2_run_lane_batch_idx;
drop index if exists public.candidate_rank_snapshots_v2_run_idx;

create unique index candidate_research_batches_v2_run_cycle_idx
  on public.candidate_research_batches_v2(campaign_run_id, research_cycle_id);
create unique index candidate_qualification_batches_v2_run_cycle_idx
  on public.candidate_qualification_batches_v2(campaign_run_id, research_cycle_id);
create unique index candidate_qualification_batches_v2_cycle_input_idx
  on public.candidate_qualification_batches_v2(research_cycle_id, input_hash);
create unique index comparative_batches_v2_cycle_lane_batch_idx
  on public.comparative_batches(research_cycle_id, lane, batch_number)
  where research_cycle_id is not null;
create unique index candidate_rank_snapshots_v2_cycle_idx
  on public.candidate_rank_snapshots(research_cycle_id)
  where research_cycle_id is not null;

create index candidate_research_batches_v2_cycle_status_idx
  on public.candidate_research_batches_v2(workspace_id, research_cycle_id, status);
create index candidate_qualification_batches_v2_cycle_status_idx
  on public.candidate_qualification_batches_v2(workspace_id, research_cycle_id, status);
