alter table public.campaign_strategy_stage_runs_v2
  drop constraint if exists campaign_strategy_stage_runs_v2_stage_id_check;

-- Preserve historical attempt diagnostics while preventing the removed full-Strategy
-- stage identifier from blocking the new constraint. Its versioned cache keys cannot
-- be reused by the advisory-delta contract.
update public.campaign_strategy_stage_runs_v2
set stage_id = 'advisory_delta'
where stage_id = 'strategy_proposal';

alter table public.campaign_strategy_stage_runs_v2
  add constraint campaign_strategy_stage_runs_v2_stage_id_check
  check (stage_id in ('baseline', 'market_context', 'advisory_delta', 'compilation'));
