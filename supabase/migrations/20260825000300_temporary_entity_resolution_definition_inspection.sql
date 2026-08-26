create or replace function public.inspect_entity_resolution_v2_definition()
returns text
language sql
security definer
set search_path = public
as $$
  select pg_get_functiondef(
    'public.resolve_campaign_entities_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  );
$$;

revoke all on function public.inspect_entity_resolution_v2_definition()
  from public, anon, authenticated;
grant execute on function public.inspect_entity_resolution_v2_definition()
  to service_role;
