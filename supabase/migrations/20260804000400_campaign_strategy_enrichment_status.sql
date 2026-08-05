create or replace function public.get_campaign_strategy_enrichment_v2(
  target_workspace_id uuid,
  target_strategy_draft_id uuid
) returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(latest) order by latest.stage_id), '[]'::jsonb)
  from (
    select distinct on (stage_id)
      stage_id,
      status,
      output_json,
      error_code,
      error_message,
      attempt_count,
      updated_at
    from public.campaign_strategy_stage_runs_v2
    where workspace_id = target_workspace_id
      and strategy_draft_id = target_strategy_draft_id
    order by stage_id, updated_at desc
  ) latest;
$$;

revoke all on function public.get_campaign_strategy_enrichment_v2(uuid, uuid) from public;
grant execute on function public.get_campaign_strategy_enrichment_v2(uuid, uuid) to authenticated;
