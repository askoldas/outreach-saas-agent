-- 20260729001100 replaced this security-definer function after its pgcrypto
-- search-path repair had already been applied. Restore extensions lookup for
-- databases that ran the original replacement before its digest calls were
-- explicitly qualified.

alter function public.persist_discovery_segment_coverage_once_v2(
  uuid,
  uuid,
  uuid,
  jsonb,
  jsonb
)
set search_path = public, extensions;
