-- Entity Resolution consumes a durably finalized discovery pass before the
-- adaptive discovery run itself is saturated. Preserve the legacy immutable
-- resolver while adapting its terminal-run precondition transactionally.

alter function public.materialize_campaign_organization_references_v2(uuid, uuid)
  rename to materialize_campaign_organization_references_before_adaptive_pass_v2;

revoke all on function
  public.materialize_campaign_organization_references_before_adaptive_pass_v2(uuid, uuid)
from public, anon, authenticated, service_role;

create function public.materialize_campaign_organization_references_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  discovery_run public.discovery_runs_v2;
  original_status text;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select * into discovery_run
  from public.discovery_runs_v2
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
  for update;
  if discovery_run.id is null then
    raise exception 'Semantic Discovery Run not found.';
  end if;
  original_status := discovery_run.status;
  if original_status = 'running_targeted_pass' then
    if (
      select decision.decision_json->>'decision'
      from public.discovery_pass_decisions_v2 decision
      where decision.discovery_run_id = discovery_run.id
      order by decision.pass_number desc
      limit 1
    ) is distinct from 'continue' then
      raise exception 'Entity Resolution requires a finalized Discovery pass.';
    end if;
    update public.discovery_runs_v2
    set status = 'completed'
    where id = discovery_run.id;
  elsif original_status not in ('completed', 'stopped_budget', 'stopped_user') then
    raise exception 'Entity Resolution requires a finalized Discovery pass.';
  end if;

  result := public.materialize_campaign_organization_references_before_adaptive_pass_v2(
    target_workspace_id,
    target_campaign_run_id
  );

  if original_status = 'running_targeted_pass' then
    update public.discovery_runs_v2
    set status = original_status
    where id = discovery_run.id;
  end if;
  return result;
end;
$$;

alter function public.resolve_campaign_entities_v2(uuid, uuid, text, text, jsonb)
  rename to resolve_campaign_entities_before_adaptive_pass_v2;

revoke all on function
  public.resolve_campaign_entities_before_adaptive_pass_v2(
    uuid, uuid, text, text, jsonb
  )
from public, anon, authenticated, service_role;

create function public.resolve_campaign_entities_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_rules_version text,
  target_input_hash text,
  target_candidates jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  discovery_run public.discovery_runs_v2;
  original_status text;
  result jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  select * into discovery_run
  from public.discovery_runs_v2
  where workspace_id = target_workspace_id
    and campaign_run_id = target_campaign_run_id
  for update;
  if discovery_run.id is null then
    raise exception 'Semantic Discovery Run not found.';
  end if;
  original_status := discovery_run.status;
  if original_status = 'running_targeted_pass' then
    if (
      select decision.decision_json->>'decision'
      from public.discovery_pass_decisions_v2 decision
      where decision.discovery_run_id = discovery_run.id
      order by decision.pass_number desc
      limit 1
    ) is distinct from 'continue' then
      raise exception 'Entity Resolution requires a finalized Discovery pass.';
    end if;
    update public.discovery_runs_v2
    set status = 'completed'
    where id = discovery_run.id;
  elsif original_status not in ('completed', 'stopped_budget', 'stopped_user') then
    raise exception 'Entity Resolution requires a finalized Discovery pass.';
  end if;

  result := public.resolve_campaign_entities_before_adaptive_pass_v2(
    target_workspace_id,
    target_campaign_run_id,
    target_rules_version,
    target_input_hash,
    target_candidates
  );

  if original_status = 'running_targeted_pass' then
    update public.discovery_runs_v2
    set status = original_status
    where id = discovery_run.id;
  end if;
  return result;
end;
$$;

revoke all on function
  public.materialize_campaign_organization_references_v2(uuid, uuid)
from public, anon, authenticated;
grant execute on function
  public.materialize_campaign_organization_references_v2(uuid, uuid)
to service_role;
revoke all on function
  public.resolve_campaign_entities_v2(uuid, uuid, text, text, jsonb)
from public, anon, authenticated;
grant execute on function
  public.resolve_campaign_entities_v2(uuid, uuid, text, text, jsonb)
to service_role;

notify pgrst, 'reload schema';
