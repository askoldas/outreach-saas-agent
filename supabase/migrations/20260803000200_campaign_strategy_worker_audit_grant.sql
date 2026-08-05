-- The Campaign Strategy compiler now runs in Trigger.dev under the trusted service role.
grant execute on function public.record_campaign_strategy_ai_requests_v2(
  uuid, uuid, jsonb
) to service_role;
