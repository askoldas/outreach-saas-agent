-- Discovery provider responses are persisted atomically and may contain enough
-- source/candidate rows to exceed the API role's short default statement timeout.
-- Keep the longer budget local to this one bounded, idempotent persistence RPC.

alter function public.persist_discovery_provider_response(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  jsonb,
  jsonb,
  text
) set statement_timeout = '120s';
