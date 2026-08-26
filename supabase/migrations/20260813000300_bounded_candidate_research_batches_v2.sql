-- Allow a Candidate Research cycle to freeze a prioritized subset of the resolved pool.
-- The existing initializer remains authoritative for tenancy, provenance, identity,
-- idempotency, and member creation; only its all-candidates cardinality invariant changes.

do $$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef(procedure_row.oid)
  into function_definition
  from pg_proc procedure_row
  where procedure_row.oid =
    'public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb)'::regprocedure;

  if function_definition is null then
    raise exception 'Candidate Research batch initializer was not found.';
  end if;

  revised_definition := replace(
    function_definition,
    $body$if jsonb_array_length(target_plans) <> expected_candidate_count then
    raise exception 'Candidate Research plan set does not match Entity Resolution.';
  end if;$body$,
    $body$if jsonb_array_length(target_plans) > expected_candidate_count
    or (expected_candidate_count > 0 and jsonb_array_length(target_plans) = 0)
  then
    raise exception 'Candidate Research plan subset exceeds or omits the resolved pool.';
  end if;$body$
  );
  revised_definition := replace(
    revised_definition,
    $body$) <> expected_candidate_count then
    raise exception 'Candidate Research plan set contains duplicate candidates.';$body$,
    $body$) <> jsonb_array_length(target_plans) then
    raise exception 'Candidate Research plan set contains duplicate candidates.';$body$
  );

  if revised_definition = function_definition
    or position('plan subset exceeds or omits' in revised_definition) = 0
    or position(') <> jsonb_array_length(target_plans) then' in revised_definition) = 0
  then
    raise exception 'Candidate Research initializer did not match the expected prior contract.';
  end if;

  execute revised_definition;
end;
$$;
