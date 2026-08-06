-- pgcrypto is installed in Supabase's extensions schema. Add it to the
-- deployed security-definer function's restricted lookup path.
alter function public.persist_provider_candidate_preclassifications_v2(
  uuid, uuid, jsonb
) set search_path = public, extensions;
