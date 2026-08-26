-- Avoid PostgreSQL JSON/operator precedence ambiguity when constructing the
-- normalized candidate description from a JSONB organization reference.

do $migration$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef(
    'public.persist_discovery_source_expansion_v2(uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz)'::regprocedure
  ) into function_definition;

  if function_definition is null then
    raise exception 'Discovery source expansion persistence function was not found.';
  end if;

  revised_definition := replace(
    function_definition,
    $old$'Discovered through ' || organization->>'discoverySourceUrl'$old$,
    $new$concat('Discovered through ', organization->>'discoverySourceUrl')$new$
  );

  if revised_definition = function_definition
    or position(
      $expected$concat('Discovered through ', organization->>'discoverySourceUrl')$expected$
      in revised_definition
    ) = 0
  then
    raise exception 'Discovery source description expression did not match the expected prior contract.';
  end if;

  execute revised_definition;
end;
$migration$;

revoke all on function public.persist_discovery_source_expansion_v2(
  uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz
) from public, anon, authenticated;

grant execute on function public.persist_discovery_source_expansion_v2(
  uuid,uuid,uuid,uuid,text,text,text,jsonb,text,text,text,timestamptz
) to service_role;

