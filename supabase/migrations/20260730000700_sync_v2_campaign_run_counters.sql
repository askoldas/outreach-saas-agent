-- V2 stage artifacts are canonical, but the campaign_runs counters remain the
-- compatibility read model used by progress panels and run history. Keep that
-- read model synchronized whenever a durable V2 stage settles.

create or replace function public.sync_v2_campaign_run_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign_run_id uuid;
  progress_delta jsonb;
begin
  if new.status not in ('completed', 'partial', 'blocked', 'skipped')
    or new.output_reference_json is null
  then
    return new;
  end if;

  select workflow.campaign_run_id
  into target_campaign_run_id
  from public.intelligence_workflow_runs workflow
  where workflow.id = new.workflow_run_id
    and workflow.workspace_id = new.workspace_id
    and workflow.workflow_family = 'campaign_v2';

  if target_campaign_run_id is null then
    return new;
  end if;

  progress_delta := coalesce(
    new.output_reference_json->'progressDelta',
    '{}'::jsonb
  );

  if new.task_type = 'discover' then
    update public.campaign_runs
    set
      candidates_discovered = greatest(
        candidates_discovered,
        coalesce((progress_delta->>'providerRecords')::integer, 0)
      ),
      candidates_unique = greatest(
        candidates_unique,
        coalesce((progress_delta->>'uniqueCandidateGroups')::integer, 0)
      ),
      candidates_classified = greatest(
        candidates_classified,
        coalesce((progress_delta->>'normalizedCandidates')::integer, 0)
      ),
      current_iteration = greatest(
        current_iteration,
        coalesce((progress_delta->>'discoveryPasses')::integer, 0)
      )
    where id = target_campaign_run_id
      and workspace_id = new.workspace_id;
  elsif new.task_type = 'resolve_entities' then
    update public.campaign_runs
    set
      companies_discovered = greatest(
        companies_discovered,
        coalesce((progress_delta->>'campaignCandidates')::integer, 0)
      )
    where id = target_campaign_run_id
      and workspace_id = new.workspace_id;
  elsif new.task_type = 'qualify_candidates' then
    update public.campaign_runs
    set
      companies_evaluated = greatest(
        companies_evaluated,
        coalesce((progress_delta->>'candidatesQualified')::integer, 0)
          + coalesce(
            (progress_delta->>'candidateQualificationBlocked')::integer,
            0
          )
      ),
      companies_qualified = greatest(
        companies_qualified,
        coalesce((progress_delta->>'qualificationRecommended')::integer, 0)
          + coalesce(
            (progress_delta->>'qualificationConditional')::integer,
            0
          )
      )
    where id = target_campaign_run_id
      and workspace_id = new.workspace_id;
  end if;

  return new;
end;
$$;

drop trigger if exists intelligence_task_runs_sync_campaign_counters
  on public.intelligence_task_runs;

create trigger intelligence_task_runs_sync_campaign_counters
after insert or update of status, output_reference_json
on public.intelligence_task_runs
for each row
execute function public.sync_v2_campaign_run_counters();

-- Repair existing V2 read models from their immutable stage outputs.
with stage_progress as (
  select
    workflow.campaign_run_id,
    max(
      (task.output_reference_json->'progressDelta'->>'providerRecords')::integer
    ) filter (where task.task_type = 'discover') as candidates_discovered,
    max(
      (task.output_reference_json->'progressDelta'->>'uniqueCandidateGroups')::integer
    ) filter (where task.task_type = 'discover') as candidates_unique,
    max(
      (task.output_reference_json->'progressDelta'->>'normalizedCandidates')::integer
    ) filter (where task.task_type = 'discover') as candidates_classified,
    max(
      (task.output_reference_json->'progressDelta'->>'discoveryPasses')::integer
    ) filter (where task.task_type = 'discover') as current_iteration,
    max(
      (task.output_reference_json->'progressDelta'->>'campaignCandidates')::integer
    ) filter (where task.task_type = 'resolve_entities') as companies_discovered,
    max(
      coalesce(
        (task.output_reference_json->'progressDelta'->>'candidatesQualified')::integer,
        0
      ) + coalesce(
        (
          task.output_reference_json
            ->'progressDelta'->>'candidateQualificationBlocked'
        )::integer,
        0
      )
    ) filter (where task.task_type = 'qualify_candidates') as companies_evaluated,
    max(
      coalesce(
        (
          task.output_reference_json
            ->'progressDelta'->>'qualificationRecommended'
        )::integer,
        0
      ) + coalesce(
        (
          task.output_reference_json
            ->'progressDelta'->>'qualificationConditional'
        )::integer,
        0
      )
    ) filter (where task.task_type = 'qualify_candidates') as companies_qualified
  from public.intelligence_workflow_runs workflow
  join public.intelligence_task_runs task
    on task.workflow_run_id = workflow.id
    and task.workspace_id = workflow.workspace_id
  where workflow.workflow_family = 'campaign_v2'
    and task.status in ('completed', 'partial', 'blocked', 'skipped')
  group by workflow.campaign_run_id
)
update public.campaign_runs campaign_run
set
  candidates_discovered = greatest(
    campaign_run.candidates_discovered,
    coalesce(stage_progress.candidates_discovered, 0)
  ),
  candidates_unique = greatest(
    campaign_run.candidates_unique,
    coalesce(stage_progress.candidates_unique, 0)
  ),
  candidates_classified = greatest(
    campaign_run.candidates_classified,
    coalesce(stage_progress.candidates_classified, 0)
  ),
  current_iteration = greatest(
    campaign_run.current_iteration,
    coalesce(stage_progress.current_iteration, 0)
  ),
  companies_discovered = greatest(
    campaign_run.companies_discovered,
    coalesce(stage_progress.companies_discovered, 0)
  ),
  companies_evaluated = greatest(
    campaign_run.companies_evaluated,
    coalesce(stage_progress.companies_evaluated, 0)
  ),
  companies_qualified = greatest(
    campaign_run.companies_qualified,
    coalesce(stage_progress.companies_qualified, 0)
  )
from stage_progress
where campaign_run.id = stage_progress.campaign_run_id
  and campaign_run.workflow_version = 'v2';

revoke all on function public.sync_v2_campaign_run_counters()
  from public, anon, authenticated;
