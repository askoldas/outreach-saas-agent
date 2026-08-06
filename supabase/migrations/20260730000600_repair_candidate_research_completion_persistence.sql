-- Candidate Research completion needs pgcrypto from Supabase's extensions
-- schema. It also receives JSON null for unknown claim values, while the
-- canonical claim constraint requires a SQL NULL when epistemic status is
-- unknown. Preserve the deployed body and repair both persistence boundaries.

do $migration$
declare
  function_source text;
begin
  select routine.prosrc
  into function_source
  from pg_catalog.pg_proc routine
  where routine.oid =
    'public.complete_candidate_research_member_v2(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean)'::regprocedure;

  if function_source is null then
    raise exception 'Candidate Research member completion function is missing.';
  end if;

  if position('claim_item->''value'',' in function_source) = 0 then
    raise exception 'Candidate Research claim value persistence was not found.';
  end if;

  function_source := replace(
    function_source,
    'claim_item->''value'',',
    'case when claim_status = ''unknown'' then null else claim_item->''value'' end,'
  );

  if position('claim_item->''value'',' in function_source) > 0 then
    raise exception 'Candidate Research unknown claim repair was incomplete.';
  end if;

  execute format(
    $definition$
      create or replace function public.complete_candidate_research_member_v2(
        target_workspace_id uuid,
        target_member_id uuid,
        target_extraction_request_hash text,
        target_claims jsonb,
        target_question_findings jsonb,
        target_missing_evidence jsonb,
        target_evidence_ids jsonb,
        target_ai_request_ids jsonb,
        target_access_blocked boolean
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public, extensions
      as %L
    $definition$,
    function_source
  );
end;
$migration$;

revoke all on function public.complete_candidate_research_member_v2(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  boolean
) from public, anon, authenticated;

grant execute on function public.complete_candidate_research_member_v2(
  uuid,
  uuid,
  text,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  jsonb,
  boolean
) to service_role;
