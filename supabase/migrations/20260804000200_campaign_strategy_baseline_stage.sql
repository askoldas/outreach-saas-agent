alter table public.campaign_strategy_stage_runs_v2
  drop constraint if exists campaign_strategy_stage_runs_v2_stage_id_check;

alter table public.campaign_strategy_stage_runs_v2
  add constraint campaign_strategy_stage_runs_v2_stage_id_check
  check (stage_id in ('baseline', 'market_context', 'advisory_delta', 'compilation'));
