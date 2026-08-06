-- Durable, version-bound checkpoints for Campaign Strategy compilation.
create table public.campaign_strategy_stage_runs_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_strategy_draft_id uuid not null
    references public.campaign_strategy_drafts(id) on delete cascade,
  stage_id text not null check (
    stage_id in ('baseline', 'market_context', 'advisory_delta', 'compilation')
  ),
  cache_key text not null,
  input_hash text not null,
  prompt_version text not null,
  schema_version text not null,
  context_compiler_version text not null,
  model_route_version text not null,
  status text not null default 'pending' check (
    status in ('pending', 'running', 'completed', 'failed')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  trigger_run_id text,
  output_json jsonb,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (
    workspace_id, campaign_strategy_draft_id, stage_id, cache_key
  )
);

create index campaign_strategy_stage_runs_v2_state_idx
on public.campaign_strategy_stage_runs_v2(
  workspace_id, campaign_strategy_draft_id, status, updated_at
);

alter table public.campaign_strategy_stage_runs_v2 enable row level security;
create policy "Members can read Campaign Strategy stage runs"
on public.campaign_strategy_stage_runs_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.claim_campaign_strategy_stage_v2(
  target_workspace_id uuid,
  target_strategy_draft_id uuid,
  target_stage_id text,
  target_cache_key text,
  target_input_hash text,
  target_prompt_version text,
  target_schema_version text,
  target_context_compiler_version text,
  target_model_route_version text,
  target_trigger_run_id text
)
returns public.campaign_strategy_stage_runs_v2
language plpgsql security definer set search_path = public as $$
declare stage_record public.campaign_strategy_stage_runs_v2;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  if not exists (
    select 1 from public.campaign_strategy_drafts
    where workspace_id = target_workspace_id and id = target_strategy_draft_id
  ) then raise exception 'Campaign Strategy draft not found.'; end if;

  insert into public.campaign_strategy_stage_runs_v2 (
    workspace_id, campaign_strategy_draft_id, stage_id, cache_key, input_hash,
    prompt_version, schema_version, context_compiler_version, model_route_version,
    status, attempt_count, trigger_run_id, started_at
  ) values (
    target_workspace_id, target_strategy_draft_id, target_stage_id,
    target_cache_key, target_input_hash, target_prompt_version,
    target_schema_version, target_context_compiler_version,
    target_model_route_version, 'running', 1, target_trigger_run_id, now()
  ) on conflict (workspace_id, campaign_strategy_draft_id, stage_id, cache_key)
  do update set
    status = case
      when public.campaign_strategy_stage_runs_v2.status = 'completed'
      then 'completed' else 'running' end,
    attempt_count = case
      when public.campaign_strategy_stage_runs_v2.status = 'completed'
      then public.campaign_strategy_stage_runs_v2.attempt_count
      else public.campaign_strategy_stage_runs_v2.attempt_count + 1 end,
    trigger_run_id = case
      when public.campaign_strategy_stage_runs_v2.status = 'completed'
      then public.campaign_strategy_stage_runs_v2.trigger_run_id
      else excluded.trigger_run_id end,
    error_code = null,
    error_message = null,
    started_at = case
      when public.campaign_strategy_stage_runs_v2.status = 'completed'
      then public.campaign_strategy_stage_runs_v2.started_at else now() end,
    completed_at = case
      when public.campaign_strategy_stage_runs_v2.status = 'completed'
      then public.campaign_strategy_stage_runs_v2.completed_at else null end,
    updated_at = now()
  returning * into stage_record;
  return stage_record;
end;
$$;

create or replace function public.complete_campaign_strategy_stage_v2(
  target_workspace_id uuid,
  target_stage_run_id uuid,
  target_output jsonb
)
returns public.campaign_strategy_stage_runs_v2
language plpgsql security definer set search_path = public as $$
declare stage_record public.campaign_strategy_stage_runs_v2;
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  update public.campaign_strategy_stage_runs_v2 set
    status = 'completed', output_json = target_output,
    error_code = null, error_message = null,
    completed_at = now(), updated_at = now()
  where workspace_id = target_workspace_id and id = target_stage_run_id
    and status in ('running', 'completed')
  returning * into stage_record;
  if stage_record.id is null then raise exception 'Strategy stage is not completable.'; end if;
  return stage_record;
end;
$$;

create or replace function public.fail_campaign_strategy_stage_v2(
  target_workspace_id uuid,
  target_stage_run_id uuid,
  target_error_code text,
  target_error_message text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Forbidden'; end if;
  update public.campaign_strategy_stage_runs_v2 set
    status = 'failed', error_code = target_error_code,
    error_message = left(target_error_message, 4000),
    completed_at = now(), updated_at = now()
  where workspace_id = target_workspace_id and id = target_stage_run_id
    and status = 'running';
end;
$$;

revoke all on function public.claim_campaign_strategy_stage_v2(
  uuid, uuid, text, text, text, text, text, text, text, text
) from public, anon, authenticated;
revoke all on function public.complete_campaign_strategy_stage_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.fail_campaign_strategy_stage_v2(
  uuid, uuid, text, text
) from public, anon, authenticated;
grant execute on function public.claim_campaign_strategy_stage_v2(
  uuid, uuid, text, text, text, text, text, text, text, text
) to service_role;
grant execute on function public.complete_campaign_strategy_stage_v2(
  uuid, uuid, jsonb
) to service_role;
grant execute on function public.fail_campaign_strategy_stage_v2(
  uuid, uuid, text, text
) to service_role;
