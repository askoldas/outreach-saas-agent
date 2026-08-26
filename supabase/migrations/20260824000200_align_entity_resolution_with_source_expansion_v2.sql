-- Source-expansion candidates are normalized candidates with immutable reference
-- lineage, even though their parent directory/source page is not itself normalized.
-- Align the frozen resolver with the loader introduced by 20260813000100.

do $migration$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef(
    'public.resolve_campaign_entities_before_retry_safe_reuse_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  ) into function_definition;

  if function_definition is null then
    raise exception 'Frozen Entity Resolution persistence function was not found.';
  end if;

  revised_definition := replace(
    function_definition,
    $old$and provider_source.ingestion_status = 'normalized'$old$,
    $new$$new$
  );

  if revised_definition = function_definition
    or position(
      $obsolete$provider_source.ingestion_status = 'normalized'$obsolete$
      in revised_definition
    ) > 0
  then
    raise exception 'Entity Resolution source-status guard did not match its expected contract.';
  end if;

  execute revised_definition;
end;
$migration$;

revoke all on function public.resolve_campaign_entities_before_retry_safe_reuse_v2(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated, service_role;

revoke all on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.resolve_campaign_entities_v2(
  uuid, uuid, text, text, jsonb
) to service_role;
