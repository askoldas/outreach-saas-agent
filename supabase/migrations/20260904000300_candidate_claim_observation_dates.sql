-- Preserve source observation dates for volatile Candidate Research claims instead
-- of treating research time as event time.
-- Apply after 20260904000200_candidate_supporting_research_sources.sql.

do $$
declare
  function_source text;
  observation_source text;
  revised_source text;
begin
  select routine.prosrc
  into function_source
  from pg_catalog.pg_proc routine
  where routine.oid =
    'public.complete_candidate_research_member_v2(uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean)'::regprocedure;
  if function_source is null then
    raise exception 'Candidate Research member completion function is missing.';
  end if;

  observation_source := regexp_replace(
    function_source,
    $pattern$now\(\),[[:space:]]+claim_item->>'freshnessClass',$pattern$,
    $replacement$case
        when claim_item ? 'observedAt'
          then nullif(claim_item->>'observedAt', '')::timestamptz
        when claim_item->>'freshnessClass' = 'volatile' then null
        else now()
      end,
      claim_item->>'freshnessClass',$replacement$
  );
  if observation_source = function_source then
    raise exception 'Could not patch Candidate Research claim observation time.';
  end if;

  revised_source := regexp_replace(
    observation_source,
    $pattern$saved_claim_id,[[:space:]]+'current',[[:space:]]+case[[:space:]]+when claim_status$pattern$,
    $replacement$saved_claim_id,
        case
          when claim_item->>'freshnessClass' = 'volatile'
            and not (claim_item ? 'observedAt') then 'unknown'
          else 'current'
        end,
        case
          when claim_status$replacement$
  );
  if revised_source = observation_source
    or position('claim_item ? ''observedAt''' in revised_source) = 0
    or position('then ''unknown''' in revised_source) = 0
  then
    raise exception 'Could not patch Candidate Research observation-date handling.';
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
    revised_source
  );
end;
$$;

revoke all on function public.complete_candidate_research_member_v2(
  uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean
) from public, anon, authenticated;
grant execute on function public.complete_candidate_research_member_v2(
  uuid,uuid,text,jsonb,jsonb,jsonb,jsonb,jsonb,boolean
) to service_role;
