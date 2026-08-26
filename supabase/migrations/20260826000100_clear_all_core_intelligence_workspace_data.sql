-- Extend workspace cleanup across artifacts introduced after the original V2
-- cleanup chain. Restrictive immutable references require their dependants to
-- be removed before the legacy tenant-scoped cleanup runs.

create or replace function public.reject_discovery_provider_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.workspace_cleanup_id', true) = old.workspace_id::text
  then
    return old;
  end if;
  raise exception
    'Discovery provider source and normalized records are immutable after insertion.';
end;
$$;

create or replace function public.reject_core_intelligence_artifact_mutation_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE'
    and current_setting('app.workspace_cleanup_id', true) = old.workspace_id::text
  then
    return old;
  end if;
  raise exception 'Core Intelligence artifact versions are immutable.';
end;
$$;

create or replace function public.reject_v2_market_analysis_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.workspace_cleanup_id', true) = old.workspace_id::text then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if old.campaign_target_model_version_id is not null then
    raise exception 'V2 Market Analysis versions are immutable.';
  end if;
  return old;
end;
$$;

alter function public.clear_workspace_data(uuid)
  rename to clear_workspace_data_before_core_intelligence_v2;

revoke all on function
  public.clear_workspace_data_before_core_intelligence_v2(uuid)
from public, anon, authenticated;

create function public.clear_workspace_data(target_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  perform set_config('app.workspace_cleanup_id', target_workspace_id::text, true);

  -- Remove review/ranking and qualification dependants before their frozen
  -- Core Intelligence bindings.
  delete from public.candidate_rank_entries where workspace_id = target_workspace_id;
  delete from public.candidate_rank_snapshots where workspace_id = target_workspace_id;
  delete from public.comparative_anomalies where workspace_id = target_workspace_id;
  delete from public.comparative_batch_members where workspace_id = target_workspace_id;
  delete from public.comparative_batches where workspace_id = target_workspace_id;
  delete from public.candidate_corrections_v2 where workspace_id = target_workspace_id;
  delete from public.candidate_review_decisions_v2 where workspace_id = target_workspace_id;
  delete from public.candidate_qualification_ai_outputs_v2
    where workspace_id = target_workspace_id;
  delete from public.candidate_qualification_batch_members_v2
    where workspace_id = target_workspace_id;
  delete from public.candidate_qualification_batches_v2
    where workspace_id = target_workspace_id;
  delete from public.candidate_explanations where workspace_id = target_workspace_id;
  delete from public.candidate_evaluation_events where workspace_id = target_workspace_id;
  delete from public.candidate_review_lane_assignments where workspace_id = target_workspace_id;
  delete from public.candidate_eligibility_decisions where workspace_id = target_workspace_id;
  delete from public.candidate_confidence_calculations where workspace_id = target_workspace_id;
  delete from public.candidate_score_calculations where workspace_id = target_workspace_id;
  delete from public.candidate_factor_evaluations where workspace_id = target_workspace_id;
  delete from public.candidate_exclusion_assessments where workspace_id = target_workspace_id;
  delete from public.candidate_relationship_assessments where workspace_id = target_workspace_id;
  delete from public.candidate_evaluation_versions where workspace_id = target_workspace_id;
  delete from public.qualification_rubrics where workspace_id = target_workspace_id;

  delete from public.commercial_relationship_assessment_versions_v2
    where workspace_id = target_workspace_id;
  delete from public.company_intelligence_versions_v2
    where workspace_id = target_workspace_id;

  -- Remove the new campaign-level Core Intelligence graph from leaves to roots.
  delete from public.market_research_plan_versions_v2
    where workspace_id = target_workspace_id;
  delete from public.research_blueprint_versions_v2
    where workspace_id = target_workspace_id;
  delete from public.market_analysis_confirmations_v2
    where workspace_id = target_workspace_id;
  update public.market_analyses
  set profile_snapshot_id = null,
      commercial_intelligence_version_id = null,
      campaign_target_model_version_id = null,
      campaign_strategy_version_id = null,
      supersedes_market_analysis_id = null
  where workspace_id = target_workspace_id;
  delete from public.campaign_target_model_versions_v2
    where workspace_id = target_workspace_id;
  delete from public.commercial_intelligence_versions_v2
    where workspace_id = target_workspace_id;

  -- Break the adaptive-cycle self reference before campaign deletion cascades.
  update public.campaign_research_cycles_v2
  set continuation_of_cycle_id = null
  where workspace_id = target_workspace_id;

  -- Organization References restrict deletion of every immutable provider
  -- lineage table, so they must be removed before the provider cleanup chain.
  delete from public.organization_references_v2
  where workspace_id = target_workspace_id;

  perform public.clear_workspace_data_before_core_intelligence_v2(
    target_workspace_id
  );
end;
$$;

revoke all on function public.clear_workspace_data(uuid) from public, anon;
grant execute on function public.clear_workspace_data(uuid) to authenticated;

