create or replace function public.inspect_entity_resolution_v2_definition()
returns text
language sql
security definer
set search_path = public
as $$
  select pg_get_functiondef(
    'public.resolve_campaign_entities_before_retry_safe_reuse_v2(uuid,uuid,text,text,jsonb)'::regprocedure
  );
$$;
