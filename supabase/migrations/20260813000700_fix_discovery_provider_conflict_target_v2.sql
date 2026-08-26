-- Align the provider-response retry boundary with source-expansion candidate identity.
-- Primary web-result candidates retain a null reference key; NULLS NOT DISTINCT makes
-- that value an idempotent primary-candidate identity while expanded organizations use
-- their durable reference key.

do $migration$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef(
    'public.persist_discovery_provider_response(uuid,uuid,text,text,text,text,jsonb,text,text,text,jsonb,jsonb,text)'::regprocedure
  ) into function_definition;

  if function_definition is null then
    raise exception 'Discovery provider response persistence function was not found.';
  end if;

  revised_definition := regexp_replace(
    function_definition,
    'on conflict[[:space:]]*\([[:space:]]*provider_source_record_id[[:space:]]*,[[:space:]]*normalization_version[[:space:]]*\)[[:space:]]*do nothing',
    'on conflict (provider_source_record_id, normalization_version, candidate_reference_key) do nothing',
    'i'
  );

  if revised_definition = function_definition
    or position(
      'on conflict (provider_source_record_id, normalization_version, candidate_reference_key) do nothing'
      in lower(revised_definition)
    ) = 0
  then
    raise exception 'Discovery provider response conflict target did not match the expected prior contract.';
  end if;

  execute revised_definition;
end;
$migration$;

revoke all on function public.persist_discovery_provider_response(
  uuid, uuid, text, text, text, text, jsonb, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;

grant execute on function public.persist_discovery_provider_response(
  uuid, uuid, text, text, text, text, jsonb, text, text, text, jsonb, jsonb, text
) to service_role;

