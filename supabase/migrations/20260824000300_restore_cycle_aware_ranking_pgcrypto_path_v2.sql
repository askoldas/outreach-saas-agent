-- The cycle-binding migration recreated Ranking persistence after the original
-- pgcrypto search-path repair and inadvertently dropped the extensions schema.

alter function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
)
set search_path = public, extensions;

revoke all on function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
) to service_role;
