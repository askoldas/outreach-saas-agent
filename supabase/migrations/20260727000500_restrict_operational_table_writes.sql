do $$
declare
  operational_table text;
begin
  foreach operational_table in array array[
    'activity_events',
    'campaign_runs',
    'campaign_run_events',
    'operation_idempotency_keys',
    'provider_executions',
    'ai_requests',
    'usage_ledger',
    'budget_reservations'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'Admins can manage ' || operational_table,
      operational_table
    );
  end loop;
end;
$$;

-- Members retain the existing SELECT policies. Mutations now require the service
-- role or a separately granted security-definer RPC such as create_clean_campaign_run.
