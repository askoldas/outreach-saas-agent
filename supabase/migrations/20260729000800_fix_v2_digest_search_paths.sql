-- Supabase installs pgcrypto in the extensions schema. These active V2 RPCs
-- call digest(), so their security-definer search paths must include it.

alter function public.compile_campaign_strategy_v2_draft(
  uuid, uuid, jsonb
)
set search_path = public, extensions;

alter function public.persist_discovery_segment_coverage_once_v2(
  uuid, uuid, uuid, jsonb, jsonb
)
set search_path = public, extensions;

alter function public.finalize_discovery_pass_v2(
  uuid, uuid, integer, uuid[], jsonb, jsonb, jsonb
)
set search_path = public, extensions;

alter function public.start_targeted_discovery_pass_v2(
  uuid, uuid, integer, jsonb
)
set search_path = public, extensions;

alter function public.complete_targeted_discovery_segment_pass_v2(
  uuid, uuid, jsonb
)
set search_path = public, extensions;

alter function public.persist_candidate_research_source_v2(
  uuid, uuid, text, uuid, text, text, text, text, timestamptz
)
set search_path = public, extensions;

alter function public.save_candidate_research_extraction_v2(
  uuid, uuid, text, jsonb, jsonb
)
set search_path = public, extensions;

alter function public.complete_candidate_research_member_v2(
  uuid, uuid, text, jsonb, jsonb, jsonb, jsonb, jsonb, boolean
)
set search_path = public, extensions;

alter function public.save_candidate_qualification_ai_output_v2(
  uuid, uuid, text, text, jsonb, jsonb
)
set search_path = public, extensions;

alter function public.persist_campaign_ranking_v2(
  uuid, uuid, uuid, text, text, text, jsonb, jsonb, jsonb
)
set search_path = public, extensions;
