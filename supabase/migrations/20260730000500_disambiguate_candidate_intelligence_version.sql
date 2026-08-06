-- Candidate Research uses intelligence_version both as a table alias and as
-- the row variable that receives the newly compiled intelligence version.
-- PostgreSQL rejects the earlier table read before the new row is persisted.
-- Preserve the deployed function body and rename only the receiving variable.

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

  if position(
    'intelligence_version public.candidate_intelligence_versions;'
    in function_source
  ) = 0 then
    raise exception 'Candidate Research intelligence row variable was not found.';
  end if;

  function_source := replace(
    function_source,
    'intelligence_version public.candidate_intelligence_versions;',
    'saved_intelligence_version public.candidate_intelligence_versions;'
  );
  function_source := replace(
    function_source,
    'returning * into intelligence_version;',
    'returning * into saved_intelligence_version;'
  );
  function_source := replace(
    function_source,
    '''intelligenceVersionId'', intelligence_version.id',
    '''intelligenceVersionId'', saved_intelligence_version.id'
  );
  function_source := replace(
    function_source,
    'intelligence_version_id = intelligence_version.id,',
    'intelligence_version_id = saved_intelligence_version.id,'
  );
  function_source := replace(
    function_source,
    'current_intelligence_version_id = intelligence_version.id,',
    'current_intelligence_version_id = saved_intelligence_version.id,'
  );
  function_source := replace(
    function_source,
    '''contentHash'', intelligence_version.content_hash',
    '''contentHash'', saved_intelligence_version.content_hash'
  );

  if position('returning * into intelligence_version;' in function_source) > 0
    or position(
      '''intelligenceVersionId'', intelligence_version.id'
      in function_source
    ) > 0
    or position(
      'intelligence_version_id = intelligence_version.id,'
      in function_source
    ) > 0
    or position(
      'current_intelligence_version_id = intelligence_version.id,'
      in function_source
    ) > 0
    or position(
      '''contentHash'', intelligence_version.content_hash'
      in function_source
    ) > 0
  then
    raise exception 'Candidate Research intelligence row rename was incomplete.';
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
      set search_path = public
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
