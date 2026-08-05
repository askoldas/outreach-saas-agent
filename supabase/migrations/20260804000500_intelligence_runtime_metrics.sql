-- Tenant-scoped operational metrics for the shared Intelligence AI runtime.
create or replace function public.get_intelligence_runtime_metrics(
  target_workspace_id uuid,
  target_since timestamptz default (now() - interval '24 hours')
)
returns table (
  task_id text,
  actual_model text,
  initial_attempts bigint,
  completed_outputs bigint,
  failed_attempts bigint,
  repair_attempts bigint,
  fallback_attempts bigint,
  timeout_attempts bigint,
  truncation_attempts bigint,
  semantic_failure_attempts bigint,
  successful_output_rate numeric,
  repair_rate numeric,
  fallback_rate numeric,
  timeout_rate numeric,
  truncation_rate numeric,
  p50_latency_ms integer,
  p95_latency_ms integer,
  total_input_units numeric,
  total_output_units numeric,
  total_cost numeric,
  currency text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_since > now() or target_since < now() - interval '90 days' then
    raise exception 'Intelligence metrics window must be within the last 90 days';
  end if;
  if auth.role() <> 'service_role' and not public.is_workspace_member(target_workspace_id) then
    raise exception 'Not authorized to inspect Intelligence runtime metrics';
  end if;

  return query
  select
    attempts.task_id,
    coalesce(attempts.actual_model, attempts.requested_model, 'unknown') as actual_model,
    count(*) filter (where attempts.attempt_kind = 'initial') as initial_attempts,
    count(*) filter (where attempts.status = 'completed') as completed_outputs,
    count(*) filter (where attempts.status = 'failed') as failed_attempts,
    count(*) filter (where attempts.attempt_kind = 'repair') as repair_attempts,
    count(*) filter (where attempts.fallback_used) as fallback_attempts,
    count(*) filter (where attempts.error_code = 'AI_TIMEOUT') as timeout_attempts,
    count(*) filter (where attempts.error_code = 'AI_TRUNCATED') as truncation_attempts,
    count(*) filter (where attempts.error_code = 'AI_SEMANTIC_VALIDATION_FAILED') as semantic_failure_attempts,
    round(
      count(*) filter (where attempts.status = 'completed')::numeric /
      nullif(
        count(*) filter (where attempts.status = 'completed') +
        count(*) filter (
          where attempts.status = 'failed'
            and coalesce(attempts.error_code, '') not in (
              'AI_INVALID_JSON',
              'AI_SCHEMA_VALIDATION_FAILED',
              'AI_UNSUPPORTED_STRUCTURED_OUTPUT'
            )
        ),
        0
      ),
      4
    ) as successful_output_rate,
    round(
      count(*) filter (where attempts.attempt_kind = 'repair')::numeric /
      nullif(
        count(*) filter (where attempts.status = 'completed') +
        count(*) filter (
          where attempts.status = 'failed'
            and coalesce(attempts.error_code, '') not in (
              'AI_INVALID_JSON',
              'AI_SCHEMA_VALIDATION_FAILED',
              'AI_UNSUPPORTED_STRUCTURED_OUTPUT'
            )
        ),
        0
      ),
      4
    ) as repair_rate,
    round(count(*) filter (where attempts.fallback_used)::numeric / nullif(count(*), 0), 4) as fallback_rate,
    round(count(*) filter (where attempts.error_code = 'AI_TIMEOUT')::numeric / nullif(count(*), 0), 4) as timeout_rate,
    round(count(*) filter (where attempts.error_code = 'AI_TRUNCATED')::numeric / nullif(count(*), 0), 4) as truncation_rate,
    percentile_disc(0.50) within group (order by attempts.latency_ms)::integer as p50_latency_ms,
    percentile_disc(0.95) within group (order by attempts.latency_ms)::integer as p95_latency_ms,
    coalesce(sum(attempts.input_units), 0)::numeric as total_input_units,
    coalesce(sum(attempts.output_units), 0)::numeric as total_output_units,
    coalesce(sum(attempts.actual_cost), 0)::numeric as total_cost,
    coalesce(max(attempts.currency), 'USD') as currency
  from public.intelligence_ai_attempts attempts
  where attempts.workspace_id = target_workspace_id
    and attempts.created_at >= target_since
  group by attempts.task_id, coalesce(attempts.actual_model, attempts.requested_model, 'unknown')
  order by attempts.task_id, actual_model;
end;
$$;

revoke all on function public.get_intelligence_runtime_metrics(uuid, timestamptz) from public, anon;
grant execute on function public.get_intelligence_runtime_metrics(uuid, timestamptz) to authenticated, service_role;
