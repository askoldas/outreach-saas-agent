-- Candidate Research declares organization_id as a PL/pgSQL variable and also
-- joins tables that expose an organization_id column. PostgreSQL's default
-- conflict mode rejects those statements as ambiguous. Recompile only this
-- worker RPC with its existing body and an explicit variable-resolution mode.

do $migration$
declare
  function_source text;
begin
  select routine.prosrc
  into function_source
  from pg_catalog.pg_proc routine
  where routine.oid =
    'public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb)'::regprocedure;

  if function_source is null then
    raise exception 'Candidate Research batch initializer is missing.';
  end if;

  function_source := regexp_replace(
    function_source,
    '^[[:space:]]*#variable_conflict[[:space:]]+[a-z_]+[[:space:]]*',
    ''
  );

  execute format(
    $definition$
      create or replace function public.initialize_candidate_research_batch_v2(
        target_workspace_id uuid,
        target_campaign_run_id uuid,
        target_contract_version text,
        target_input_hash text,
        target_plans jsonb
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = public
      as %L
    $definition$,
    '#variable_conflict use_variable' || chr(10) || function_source
  );
end;
$migration$;

revoke all on function public.initialize_candidate_research_batch_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.initialize_candidate_research_batch_v2(
  uuid,
  uuid,
  text,
  text,
  jsonb
) to service_role;
