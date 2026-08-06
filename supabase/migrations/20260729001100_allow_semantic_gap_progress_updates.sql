-- A Semantic Discovery gap keeps one stable key across targeted passes.
-- Its segment and type are immutable identity. Its description, metrics,
-- severity, and status are current observations and must evolve as coverage
-- changes between passes.

create or replace function public.persist_discovery_segment_coverage_once_v2(
  target_workspace_id uuid,
  target_run_id uuid,
  target_segment_run_id uuid,
  target_coverage jsonb,
  target_gaps jsonb
)
returns public.discovery_coverage_snapshots_v2
language plpgsql
security definer
set search_path = public
as $$
declare
  segment_run public.discovery_segment_runs_v2;
  segment public.discovery_segments_v2;
  discovery_run public.discovery_runs_v2;
  existing_snapshot public.discovery_coverage_snapshots_v2;
  saved_snapshot public.discovery_coverage_snapshots_v2;
  saved_gap public.discovery_gaps_v2;
  saved_action public.discovery_gap_actions_v2;
  gap jsonb;
  action jsonb;
  target_settlement_hash text;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into segment_run
  from public.discovery_segment_runs_v2
  where id = target_segment_run_id
    and workspace_id = target_workspace_id
    and discovery_run_id = target_run_id
  for update;
  if segment_run.id is null then
    raise exception 'Semantic Discovery Segment Run not found.';
  end if;
  select * into segment
  from public.discovery_segments_v2
  where id = segment_run.discovery_segment_id;
  select * into discovery_run
  from public.discovery_runs_v2
  where id = target_run_id;

  if target_coverage->>'campaignId' <> discovery_run.campaign_id::text
    or target_coverage->>'discoverySegmentId' <> segment.segment_key
    or target_coverage->>'archetypeId' <> segment.campaign_archetype_key
  then
    raise exception 'Semantic Discovery coverage identity mismatch.';
  end if;

  target_settlement_hash := encode(
    extensions.digest(
      jsonb_build_object(
        'coverage', target_coverage,
        'gaps', target_gaps
      )::text,
      'sha256'
    ),
    'hex'
  );
  select * into existing_snapshot
  from public.discovery_coverage_snapshots_v2
  where discovery_segment_run_id = target_segment_run_id
  for update;
  if existing_snapshot.id is not null then
    if existing_snapshot.metrics_json <> target_coverage
      or (
        existing_snapshot.settlement_hash is not null
        and existing_snapshot.settlement_hash <> target_settlement_hash
      )
    then
      raise exception 'Semantic Discovery coverage retry changed settled work.';
    end if;
    if existing_snapshot.settlement_hash is not null then
      return existing_snapshot;
    end if;
    update public.discovery_coverage_snapshots_v2
    set settlement_hash = target_settlement_hash
    where id = existing_snapshot.id
    returning * into saved_snapshot;
  else
    insert into public.discovery_coverage_snapshots_v2 (
      workspace_id,
      discovery_run_id,
      discovery_segment_run_id,
      archetype_key,
      geography_key,
      metrics_json,
      confidence,
      status,
      reasons_json,
      settlement_hash
    ) values (
      target_workspace_id,
      target_run_id,
      target_segment_run_id,
      target_coverage->>'archetypeId',
      target_coverage->>'geographyKey',
      target_coverage,
      (target_coverage->>'confidence')::numeric,
      target_coverage->>'status',
      target_coverage->'reasons',
      target_settlement_hash
    )
    returning * into saved_snapshot;
  end if;

  for gap in select * from jsonb_array_elements(target_gaps) loop
    if gap->>'campaignId' <> discovery_run.campaign_id::text
      or gap->>'discoverySegmentId' <> segment.segment_key
    then
      raise exception 'Semantic Discovery gap identity mismatch.';
    end if;

    select * into saved_gap
    from public.discovery_gaps_v2
    where discovery_run_id = target_run_id
      and gap_key = gap->>'id'
    for update;
    if saved_gap.id is null then
      insert into public.discovery_gaps_v2 (
        workspace_id,
        discovery_run_id,
        discovery_segment_id,
        gap_key,
        gap_type,
        description,
        supporting_metrics_json,
        severity,
        status
      ) values (
        target_workspace_id,
        target_run_id,
        segment.id,
        gap->>'id',
        gap->>'type',
        gap->>'description',
        gap->'supportingMetrics',
        gap->>'severity',
        gap->>'status'
      )
      returning * into saved_gap;
    else
      if saved_gap.discovery_segment_id <> segment.id
        or saved_gap.gap_type <> gap->>'type'
      then
        raise exception 'Semantic Discovery gap key changed immutable identity.';
      end if;
      update public.discovery_gaps_v2
      set
        description = gap->>'description',
        supporting_metrics_json = gap->'supportingMetrics',
        severity = gap->>'severity',
        status = gap->>'status'
      where id = saved_gap.id
      returning * into saved_gap;
    end if;

    for action in select * from jsonb_array_elements(gap->'recommendedActions') loop
      select * into saved_action
      from public.discovery_gap_actions_v2 existing_action
      where existing_action.discovery_gap_id = saved_gap.id
        and existing_action.action_type = action->>'type'
        and existing_action.reason = action->>'reason'
        and existing_action.expected_improvement = action->>'expectedImprovement'
        and existing_action.max_calls is not distinct from
          nullif(action->>'maxCalls', '')::integer
        and existing_action.max_estimated_cost_minor is not distinct from
          nullif(action->>'maxEstimatedCostMinor', '')::numeric
      order by
        (existing_action.action_fingerprint is not null) desc,
        existing_action.created_at,
        existing_action.id
      limit 1
      for update;
      if saved_action.id is null then
        insert into public.discovery_gap_actions_v2 (
          workspace_id,
          discovery_gap_id,
          action_type,
          reason,
          expected_improvement,
          max_calls,
          max_estimated_cost_minor,
          action_fingerprint
        ) values (
          target_workspace_id,
          saved_gap.id,
          action->>'type',
          action->>'reason',
          action->>'expectedImprovement',
          nullif(action->>'maxCalls', '')::integer,
          nullif(action->>'maxEstimatedCostMinor', '')::numeric,
          encode(extensions.digest(action::text, 'sha256'), 'hex')
        )
        on conflict do nothing;
      elsif saved_action.action_fingerprint is null then
        update public.discovery_gap_actions_v2
        set action_fingerprint =
          encode(extensions.digest(action::text, 'sha256'), 'hex')
        where id = saved_action.id;
      end if;
      saved_action := null;
    end loop;
    saved_gap := null;
  end loop;

  update public.discovery_segment_runs_v2
  set
    status = case target_coverage->>'status'
      when 'sufficient' then 'coverage_sufficient'
      when 'exhausted' then 'exhausted'
      when 'blocked' then 'blocked'
      else 'coverage_insufficient'
    end,
    completed_at = now(),
    metrics_json = target_coverage,
    provider_record_count = (target_coverage->>'rawRecords')::integer,
    normalized_candidate_count =
      (target_coverage->>'normalizedCandidates')::integer,
    unique_candidate_count =
      (target_coverage->>'uniqueCandidateHints')::integer
  where id = target_segment_run_id;

  update public.discovery_segments_v2
  set status = case target_coverage->>'status'
    when 'sufficient' then 'coverage_sufficient'
    when 'exhausted' then 'exhausted'
    when 'blocked' then 'blocked'
    else 'coverage_insufficient'
  end
  where id = segment.id;

  return saved_snapshot;
end;
$$;

revoke all on function public.persist_discovery_segment_coverage_once_v2(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.persist_discovery_segment_coverage_once_v2(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb
) to service_role;
