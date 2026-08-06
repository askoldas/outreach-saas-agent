-- Retry-safe deterministic Comparative Ranking V2 runtime.
-- Apply after 20260728002600_retry_safe_candidate_qualification_stage_part_2.sql.

alter table public.comparative_batches
  add column campaign_run_id uuid references public.campaign_runs(id) on delete cascade,
  add column candidate_qualification_batch_id uuid
    references public.candidate_qualification_batches_v2(id) on delete restrict,
  add column contract_version text,
  add column input_snapshot_json jsonb
    check (
      input_snapshot_json is null
      or jsonb_typeof(input_snapshot_json) = 'object'
    ),
  add column output_reference_json jsonb
    check (
      output_reference_json is null
      or jsonb_typeof(output_reference_json) = 'object'
    );

alter table public.candidate_rank_snapshots
  add column campaign_run_id uuid references public.campaign_runs(id) on delete cascade,
  add column candidate_qualification_batch_id uuid
    references public.candidate_qualification_batches_v2(id) on delete restrict,
  add column contract_version text,
  add column status text not null default 'completed'
    check (status in ('completed', 'partial')),
  add column anomaly_count integer not null default 0
    check (anomaly_count >= 0),
  add column blocking_anomaly_count integer not null default 0
    check (blocking_anomaly_count >= 0);

create unique index comparative_batches_v2_run_lane_batch_idx
on public.comparative_batches(campaign_run_id, lane, batch_number)
where campaign_run_id is not null;

create unique index candidate_rank_snapshots_v2_run_idx
on public.candidate_rank_snapshots(campaign_run_id)
where campaign_run_id is not null;

create or replace function public.load_campaign_ranking_inputs_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  qualification_batch public.candidate_qualification_batches_v2;
  minimum_confidence numeric;
  candidates jsonb;
begin
  select *
  into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
    and workflow_version = 'v2';

  if campaign_run.id is null then
    raise exception 'Ranking Campaign Run was not found.';
  end if;

  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where campaign_run_id = campaign_run.id
    and workspace_id = target_workspace_id
    and status in ('completed', 'partial');

  if qualification_batch.id is null then
    raise exception 'Ranking requires a settled Qualification batch.';
  end if;

  minimum_confidence := coalesce(
    (qualification_batch.rubric_json
      ->'thresholds'->>'minimumConfidenceForRecommended')::numeric,
    75
  );

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'campaignCandidateId', member.campaign_candidate_id,
        'evaluationVersionId', member.candidate_evaluation_version_id,
        'organizationId', campaign_candidate.organization_id,
        'inputSnapshot', member.input_snapshot_json,
        'finalSnapshot', evaluation_version.compiled_snapshot_json
      )
      order by member.campaign_candidate_id
    ),
    '[]'::jsonb
  )
  into candidates
  from public.candidate_qualification_batch_members_v2 member
  join public.campaign_candidates campaign_candidate
    on campaign_candidate.id = member.campaign_candidate_id
    and campaign_candidate.workspace_id = member.workspace_id
  join public.candidate_evaluation_versions evaluation_version
    on evaluation_version.id = member.candidate_evaluation_version_id
    and evaluation_version.workspace_id = member.workspace_id
  where member.candidate_qualification_batch_id = qualification_batch.id
    and member.workspace_id = target_workspace_id
    and member.status = 'completed';

  return jsonb_build_object(
    'campaignId', campaign_run.campaign_id,
    'campaignRunId', campaign_run.id,
    'strategyVersionId', campaign_run.strategy_version_id,
    'qualificationBatchId', qualification_batch.id,
    'minimumRecommendedConfidence', minimum_confidence,
    'candidates', candidates
  );
end;
$$;

create or replace function public.persist_campaign_ranking_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_qualification_batch_id uuid,
  target_contract_version text,
  target_ordering_policy_version text,
  target_input_hash text,
  target_batches jsonb,
  target_anomalies jsonb,
  target_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_run public.campaign_runs;
  qualification_batch public.candidate_qualification_batches_v2;
  existing_snapshot public.candidate_rank_snapshots;
  saved_snapshot public.candidate_rank_snapshots;
  saved_batch public.comparative_batches;
  batch_item jsonb;
  member_item jsonb;
  anomaly_item jsonb;
  entry_item jsonb;
  batch_ids jsonb := '[]'::jsonb;
  candidate_count integer;
  anomaly_count integer;
  blocking_count integer;
  next_version integer;
begin
  if length(target_input_hash) <> 64
    or length(trim(target_contract_version)) = 0
    or length(trim(target_ordering_policy_version)) = 0
    or jsonb_typeof(target_batches) <> 'array'
    or jsonb_typeof(target_anomalies) <> 'array'
    or jsonb_typeof(target_entries) <> 'array'
  then
    raise exception 'Invalid Ranking V2 persistence payload.';
  end if;

  select *
  into campaign_run
  from public.campaign_runs
  where id = target_campaign_run_id
    and workspace_id = target_workspace_id
  for update;

  if campaign_run.id is null then
    raise exception 'Ranking Campaign Run was not found.';
  end if;

  if not exists (
    select 1
    from public.workspace_intelligence_settings settings
    where settings.workspace_id = target_workspace_id
      and settings.campaign_workflow = 'v2'
      and settings.result_write_mode = 'canonical'
      and settings.shadow_mode = false
  ) then
    raise exception 'Canonical Ranking V2 writes are not enabled.';
  end if;

  select *
  into qualification_batch
  from public.candidate_qualification_batches_v2
  where id = target_qualification_batch_id
    and workspace_id = target_workspace_id
    and campaign_run_id = campaign_run.id
    and status in ('completed', 'partial');

  if qualification_batch.id is null then
    raise exception 'Ranking Qualification batch mismatch.';
  end if;

  select *
  into existing_snapshot
  from public.candidate_rank_snapshots
  where campaign_run_id = campaign_run.id;

  if existing_snapshot.id is not null then
    if existing_snapshot.content_hash <> target_input_hash
      or existing_snapshot.candidate_qualification_batch_id
        <> qualification_batch.id
    then
      raise exception 'Ranking retry input does not match the frozen snapshot.';
    end if;
    select count(*)::integer
    into candidate_count
    from public.candidate_rank_entries
    where rank_snapshot_id = existing_snapshot.id;
    select coalesce(
      jsonb_agg(batch.id order by batch.lane, batch.batch_number),
      '[]'::jsonb
    )
    into batch_ids
    from public.comparative_batches batch
    where batch.campaign_run_id = campaign_run.id;
    return jsonb_build_object(
      'rankSnapshotId', existing_snapshot.id,
      'candidateCount', candidate_count,
      'anomalyCount', existing_snapshot.anomaly_count,
      'blockingAnomalyCount', existing_snapshot.blocking_anomaly_count,
      'comparativeBatchIds', batch_ids
    );
  end if;

  candidate_count := jsonb_array_length(target_entries);
  anomaly_count := jsonb_array_length(target_anomalies);
  select count(*)::integer
  into blocking_count
  from jsonb_array_elements(target_anomalies) anomaly
  where coalesce((anomaly->>'blocksFinalization')::boolean, false);

  if candidate_count <> (
    select count(*)::integer
    from public.candidate_qualification_batch_members_v2 member
    where member.candidate_qualification_batch_id = qualification_batch.id
      and member.status = 'completed'
  ) then
    raise exception 'Ranking must contain every completed Qualification member.';
  end if;

  for batch_item in
    select value from jsonb_array_elements(target_batches)
  loop
    if jsonb_typeof(batch_item->'members') <> 'array' then
      raise exception 'Ranking comparative batch members must be an array.';
    end if;
    insert into public.comparative_batches (
      workspace_id,
      campaign_id,
      campaign_strategy_version_id,
      campaign_run_id,
      candidate_qualification_batch_id,
      lane,
      batch_number,
      status,
      input_hash,
      rules_version,
      contract_version,
      input_snapshot_json,
      output_reference_json,
      completed_at
    )
    values (
      target_workspace_id,
      campaign_run.campaign_id,
      campaign_run.strategy_version_id,
      campaign_run.id,
      qualification_batch.id,
      batch_item->>'lane',
      (batch_item->>'batchNumber')::integer,
      'completed',
      encode(
        digest(
          convert_to(
            jsonb_build_object(
              'campaignRunId', campaign_run.id,
              'batch', batch_item
            )::text,
            'UTF8'
          ),
          'sha256'
        ),
        'hex'
      ),
      target_ordering_policy_version,
      target_contract_version,
      batch_item,
      jsonb_build_object('mode', 'deterministic_consistency'),
      now()
    )
    returning * into saved_batch;

    batch_ids := batch_ids || jsonb_build_array(saved_batch.id);
    for member_item in
      select value from jsonb_array_elements(batch_item->'members')
    loop
      if not exists (
        select 1
        from public.candidate_qualification_batch_members_v2 member
        where member.candidate_qualification_batch_id = qualification_batch.id
          and member.campaign_candidate_id =
            (member_item->>'campaignCandidateId')::uuid
          and member.candidate_evaluation_version_id =
            (member_item->>'evaluationVersionId')::uuid
          and member.status = 'completed'
      ) then
        raise exception 'Comparative batch contains an unfrozen Candidate.';
      end if;
      insert into public.comparative_batch_members (
        workspace_id,
        comparative_batch_id,
        campaign_candidate_id,
        candidate_evaluation_version_id,
        is_anchor,
        deterministic_position,
        comparative_position
      )
      values (
        target_workspace_id,
        saved_batch.id,
        (member_item->>'campaignCandidateId')::uuid,
        (member_item->>'evaluationVersionId')::uuid,
        false,
        (member_item->>'deterministicPosition')::integer,
        (member_item->>'deterministicPosition')::integer
      );
    end loop;
  end loop;

  for anomaly_item in
    select value from jsonb_array_elements(target_anomalies)
  loop
    select batch.*
    into saved_batch
    from public.comparative_batches batch
    join public.comparative_batch_members member
      on member.comparative_batch_id = batch.id
    where batch.campaign_run_id = campaign_run.id
      and member.campaign_candidate_id =
        (anomaly_item->'candidateIds'->>0)::uuid
    order by batch.batch_number
    limit 1;

    if saved_batch.id is null then
      raise exception 'Comparative anomaly references an unknown Candidate.';
    end if;

    insert into public.comparative_anomalies (
      workspace_id,
      comparative_batch_id,
      anomaly_type,
      candidate_ids_json,
      factor_keys_json,
      severity,
      explanation,
      recommended_action,
      blocks_finalization
    )
    values (
      target_workspace_id,
      saved_batch.id,
      anomaly_item->>'type',
      anomaly_item->'candidateIds',
      coalesce(anomaly_item->'factorKeys', '[]'::jsonb),
      anomaly_item->>'severity',
      anomaly_item->>'explanation',
      anomaly_item->>'recommendedAction',
      (anomaly_item->>'blocksFinalization')::boolean
    );
  end loop;

  select coalesce(max(snapshot.version_number), 0) + 1
  into next_version
  from public.candidate_rank_snapshots snapshot
  where snapshot.campaign_id = campaign_run.campaign_id
    and snapshot.campaign_strategy_version_id = campaign_run.strategy_version_id;

  insert into public.candidate_rank_snapshots (
    workspace_id,
    campaign_id,
    campaign_strategy_version_id,
    campaign_run_id,
    candidate_qualification_batch_id,
    version_number,
    ordering_policy_version,
    included_evaluation_ids_json,
    comparative_batch_ids_json,
    content_hash,
    contract_version,
    status,
    anomaly_count,
    blocking_anomaly_count
  )
  values (
    target_workspace_id,
    campaign_run.campaign_id,
    campaign_run.strategy_version_id,
    campaign_run.id,
    qualification_batch.id,
    next_version,
    target_ordering_policy_version,
    (
      select coalesce(
        jsonb_agg(
          (entry->>'evaluationVersionId')::uuid
          order by (entry->>'rankOverall')::integer
        ),
        '[]'::jsonb
      )
      from jsonb_array_elements(target_entries) entry
    ),
    batch_ids,
    target_input_hash,
    target_contract_version,
    case when blocking_count > 0 then 'partial' else 'completed' end,
    anomaly_count,
    blocking_count
  )
  returning * into saved_snapshot;

  for entry_item in
    select value
    from jsonb_array_elements(target_entries)
    order by (value->>'rankOverall')::integer
  loop
    if not exists (
      select 1
      from public.candidate_qualification_batch_members_v2 member
      where member.candidate_qualification_batch_id = qualification_batch.id
        and member.campaign_candidate_id =
          (entry_item->>'campaignCandidateId')::uuid
        and member.candidate_evaluation_version_id =
          (entry_item->>'evaluationVersionId')::uuid
        and member.status = 'completed'
    ) then
      raise exception 'Rank entry contains an unfrozen Candidate.';
    end if;
    insert into public.candidate_rank_entries (
      workspace_id,
      rank_snapshot_id,
      campaign_candidate_id,
      candidate_evaluation_version_id,
      lane,
      rank_overall,
      rank_within_lane,
      ordering_trace_json
    )
    values (
      target_workspace_id,
      saved_snapshot.id,
      (entry_item->>'campaignCandidateId')::uuid,
      (entry_item->>'evaluationVersionId')::uuid,
      entry_item->>'lane',
      (entry_item->>'rankOverall')::integer,
      (entry_item->>'rankWithinLane')::integer,
      entry_item->'orderingTrace'
    );
  end loop;

  return jsonb_build_object(
    'rankSnapshotId', saved_snapshot.id,
    'candidateCount', candidate_count,
    'anomalyCount', anomaly_count,
    'blockingAnomalyCount', blocking_count,
    'comparativeBatchIds', batch_ids
  );
end;
$$;

drop policy if exists "Admins can manage comparative_batches"
on public.comparative_batches;
drop policy if exists "Admins can manage comparative_batch_members"
on public.comparative_batch_members;
drop policy if exists "Admins can manage comparative_anomalies"
on public.comparative_anomalies;
drop policy if exists "Admins can manage candidate_rank_snapshots"
on public.candidate_rank_snapshots;
drop policy if exists "Admins can manage candidate_rank_entries"
on public.candidate_rank_entries;

revoke all on function public.load_campaign_ranking_inputs_v2(uuid, uuid)
from public, anon, authenticated;
revoke all on function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.load_campaign_ranking_inputs_v2(uuid, uuid)
to service_role;
grant execute on function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) to service_role;
