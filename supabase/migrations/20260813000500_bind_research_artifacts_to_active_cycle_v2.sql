-- Bind repeatable research artifacts to the latest Campaign Research cycle.
-- The Trigger workflow permits only one active cycle per campaign run, so the
-- latest immutable cycle is also the retry boundary for that invocation.

do $$
declare
  function_definition text;
  revised_definition text;
begin
  select pg_get_functiondef('public.load_campaign_candidate_research_inputs_v2(uuid,uuid)'::regprocedure)
  into function_definition;
  revised_definition := replace(
    function_definition,
    'where discovery_link.workspace_id = target_workspace_id',
    $patch$where discovery_link.workspace_id = target_workspace_id
      and not exists (
        select 1
        from public.candidate_research_batch_members_v2 prior_member
        join public.candidate_research_batches_v2 prior_batch
          on prior_batch.id = prior_member.candidate_research_batch_id
        join public.campaign_research_cycles_v2 prior_cycle
          on prior_cycle.id = prior_batch.research_cycle_id
        where prior_member.campaign_candidate_id = campaign_candidate.id
          and prior_batch.campaign_run_id = campaign_run.id
          and prior_cycle.cycle_number < (
            select max(active_cycle.cycle_number)
            from public.campaign_research_cycles_v2 active_cycle
            where active_cycle.campaign_run_id = campaign_run.id
          )
      )$patch$
  );
  if revised_definition = function_definition then
    raise exception 'Candidate Research input loader did not match its expected contract.';
  end if;
  execute revised_definition;
end;
$$;

do $$
declare
  function_source text;
  revised_source text;
begin
  select routine.prosrc into function_source
  from pg_catalog.pg_proc routine
  where routine.oid =
    'public.initialize_candidate_research_batch_v2(uuid,uuid,text,text,jsonb)'::regprocedure;
  revised_source := regexp_replace(function_source,
    'campaign_run[[:space:]]+public\.campaign_runs;',
    'campaign_run public.campaign_runs;' || chr(10) || '  research_cycle public.campaign_research_cycles_v2;');
  revised_source := regexp_replace(revised_source,
    $pattern$(if[[:space:]]+campaign_run\.id[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+raise exception 'V2 Campaign Run not found\.';[[:space:]]+end if;)$pattern$,
    $replacement$\1
  select * into research_cycle
  from public.campaign_research_cycles_v2
  where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id
  order by cycle_number desc limit 1;
  if research_cycle.id is null then
    raise exception 'Candidate Research requires a Campaign Research cycle.';
  end if;$replacement$);
  revised_source := regexp_replace(revised_source,
    '(from[[:space:]]+public\.candidate_research_batches_v2[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id)([[:space:]]+for update;)',
    '\1' || chr(10) || '    and research_cycle_id = research_cycle.id\2');
  revised_source := regexp_replace(revised_source,
    '(insert into public\.candidate_research_batches_v2[[:space:]]*\([[:space:]]*workspace_id,[[:space:]]*campaign_run_id,)',
    '\1' || chr(10) || '    research_cycle_id,');
  revised_source := regexp_replace(revised_source,
    '(\)[[:space:]]+values[[:space:]]*\([[:space:]]*target_workspace_id,[[:space:]]*campaign_run\.id,)',
    '\1' || chr(10) || '    research_cycle.id,');
  if revised_source = function_source
    or position('research_cycle_id = research_cycle.id' in revised_source) = 0
    or position('Candidate Research requires a Campaign Research cycle' in revised_source) = 0
    or position('research_cycle.id,' in revised_source) = 0
  then raise exception 'Candidate Research initializer did not match its expected contract.';
  end if;
  execute format(
    $definition$
      create or replace function public.initialize_candidate_research_batch_v2(
        target_workspace_id uuid, target_campaign_run_id uuid,
        target_contract_version text, target_input_hash text, target_plans jsonb
      ) returns jsonb language plpgsql security definer set search_path = public as %L
    $definition$,
    revised_source
  );
end;
$$;

do $$
declare function_source text; revised_source text;
begin
  select routine.prosrc into function_source from pg_catalog.pg_proc routine
  where routine.oid = 'public.load_campaign_qualification_inputs_v2(uuid,uuid)'::regprocedure;
  revised_source := regexp_replace(function_source,
    '(from[[:space:]]+public\.candidate_research_batches_v2[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id[[:space:]]+and[[:space:]]+workspace_id[[:space:]]*=[[:space:]]*target_workspace_id)([[:space:]]+and[[:space:]]+status[[:space:]]+in)',
    '\1' || chr(10) || '    and research_cycle_id = (' || chr(10) ||
    '      select id from public.campaign_research_cycles_v2' || chr(10) ||
    '      where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id' || chr(10) ||
    '      order by cycle_number desc limit 1' || chr(10) || '    )\2');
  if revised_source = function_source or position('research_cycle_id = (' in revised_source) = 0 then
    raise exception 'Qualification input loader did not match its expected contract.';
  end if;
  execute format($definition$
    create or replace function public.load_campaign_qualification_inputs_v2(
      target_workspace_id uuid, target_campaign_run_id uuid
    ) returns jsonb language plpgsql security definer set search_path = public as %L
  $definition$, revised_source);
end;
$$;

do $$
declare function_source text; revised_source text;
begin
  select routine.prosrc into function_source from pg_catalog.pg_proc routine
  where routine.oid = 'public.initialize_candidate_qualification_batch_v2(uuid,uuid,text,text,jsonb,jsonb)'::regprocedure;
  revised_source := regexp_replace(function_source,
    'campaign_run[[:space:]]+public\.campaign_runs;',
    'campaign_run public.campaign_runs;' || chr(10) || '  research_cycle public.campaign_research_cycles_v2;');
  revised_source := regexp_replace(revised_source,
    $pattern$(if[[:space:]]+campaign_run\.id[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+raise exception 'V2 Campaign Run not found\.';[[:space:]]+end if;)$pattern$,
    $replacement$\1
  select * into research_cycle
  from public.campaign_research_cycles_v2
  where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id
  order by cycle_number desc limit 1;
  if research_cycle.id is null then
    raise exception 'Qualification requires a Campaign Research cycle.';
  end if;$replacement$);
  revised_source := regexp_replace(revised_source,
    '(from[[:space:]]+public\.candidate_research_batches_v2[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id[[:space:]]+and[[:space:]]+workspace_id[[:space:]]*=[[:space:]]*target_workspace_id)([[:space:]]+and[[:space:]]+status[[:space:]]+in)',
    '\1' || chr(10) || '    and research_cycle_id = research_cycle.id\2');
  revised_source := regexp_replace(revised_source,
    '(from[[:space:]]+public\.candidate_qualification_batches_v2[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id)([[:space:]]+for update;)',
    '\1' || chr(10) || '    and research_cycle_id = research_cycle.id\2');
  revised_source := regexp_replace(revised_source,
    '(insert into public\.candidate_qualification_batches_v2[[:space:]]*\([[:space:]]*workspace_id,[[:space:]]*campaign_run_id,)',
    '\1' || chr(10) || '    research_cycle_id,');
  revised_source := regexp_replace(revised_source,
    '(\)[[:space:]]+values[[:space:]]*\([[:space:]]*target_workspace_id,[[:space:]]*campaign_run\.id,)',
    '\1' || chr(10) || '    research_cycle.id,');
  if revised_source = function_source
    or position('Qualification requires a Campaign Research cycle' in revised_source) = 0
    or position('research_cycle_id = research_cycle.id' in revised_source) = 0
    or position('research_cycle.id,' in revised_source) = 0
  then raise exception 'Qualification initializer did not match its expected contract.';
  end if;
  execute format($definition$
    create or replace function public.initialize_candidate_qualification_batch_v2(
      target_workspace_id uuid, target_campaign_run_id uuid, target_contract_version text,
      target_input_hash text, target_rubric jsonb, target_candidates jsonb
    ) returns jsonb language plpgsql security definer set search_path = public as %L
  $definition$, revised_source);
end;
$$;

do $$
declare function_source text; revised_source text;
begin
  select routine.prosrc into function_source from pg_catalog.pg_proc routine
  where routine.oid = 'public.load_campaign_ranking_inputs_v2(uuid,uuid)'::regprocedure;
  revised_source := regexp_replace(function_source,
    '(from[[:space:]]+public\.candidate_qualification_batches_v2[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id[[:space:]]+and[[:space:]]+workspace_id[[:space:]]*=[[:space:]]*target_workspace_id)([[:space:]]+and[[:space:]]+status[[:space:]]+in)',
    '\1' || chr(10) || '    and research_cycle_id = (' || chr(10) ||
    '      select id from public.campaign_research_cycles_v2' || chr(10) ||
    '      where campaign_run_id = campaign_run.id and workspace_id = target_workspace_id' || chr(10) ||
    '      order by cycle_number desc limit 1' || chr(10) || '    )\2');
  if revised_source = function_source or position('research_cycle_id = (' in revised_source) = 0 then
    raise exception 'Ranking input loader did not match its expected contract.';
  end if;
  execute format($definition$
    create or replace function public.load_campaign_ranking_inputs_v2(
      target_workspace_id uuid, target_campaign_run_id uuid
    ) returns jsonb language plpgsql security definer set search_path = public as %L
  $definition$, revised_source);
end;
$$;

do $$
declare function_source text; revised_source text;
begin
  select routine.prosrc into function_source from pg_catalog.pg_proc routine
  where routine.oid = 'public.persist_campaign_ranking_v2(uuid,uuid,uuid,text,text,text,jsonb,jsonb,jsonb)'::regprocedure;
  revised_source := regexp_replace(function_source,
    'qualification_batch[[:space:]]+public\.candidate_qualification_batches_v2;',
    'qualification_batch public.candidate_qualification_batches_v2;' || chr(10) || '  research_cycle public.campaign_research_cycles_v2;');
  revised_source := regexp_replace(revised_source,
    $pattern$(if[[:space:]]+qualification_batch\.id[[:space:]]+is[[:space:]]+null[[:space:]]+then[[:space:]]+raise exception 'Ranking Qualification batch mismatch\.';[[:space:]]+end if;)$pattern$,
    $replacement$\1
  select * into research_cycle from public.campaign_research_cycles_v2
  where id = qualification_batch.research_cycle_id
    and campaign_run_id = campaign_run.id and workspace_id = target_workspace_id;
  if research_cycle.id is null then
    raise exception 'Ranking Qualification cycle mismatch.';
  end if;$replacement$);
  revised_source := regexp_replace(revised_source,
    '(from[[:space:]]+public\.candidate_rank_snapshots[[:space:]]+where[[:space:]]+campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id);',
    '\1 and research_cycle_id = research_cycle.id;');
  revised_source := regexp_replace(revised_source,
    '(where[[:space:]]+batch\.campaign_run_id[[:space:]]*=[[:space:]]*campaign_run\.id)',
    '\1' || chr(10) || '      and batch.research_cycle_id = research_cycle.id', 'g');
  revised_source := regexp_replace(revised_source,
    '(campaign_run_id,[[:space:]]*candidate_qualification_batch_id,)',
    'campaign_run_id,' || chr(10) || '      research_cycle_id,' || chr(10) || '      candidate_qualification_batch_id,', 'g');
  revised_source := regexp_replace(revised_source,
    '(campaign_run\.id,[[:space:]]*qualification_batch\.id,)',
    'campaign_run.id,' || chr(10) || '      research_cycle.id,' || chr(10) || '      qualification_batch.id,', 'g');
  if revised_source = function_source
    or position('Ranking Qualification cycle mismatch' in revised_source) = 0
    or position('research_cycle_id = research_cycle.id' in revised_source) = 0
    or position('research_cycle.id,' in revised_source) = 0
  then raise exception 'Ranking persistence did not match its expected contract.';
  end if;
  execute format($definition$
    create or replace function public.persist_campaign_ranking_v2(
      target_workspace_id uuid, target_campaign_run_id uuid,
      target_qualification_batch_id uuid, target_contract_version text,
      target_ordering_policy_version text, target_input_hash text,
      target_batches jsonb, target_anomalies jsonb, target_entries jsonb
    ) returns jsonb language plpgsql security definer set search_path = public as %L
  $definition$, revised_source);
end;
$$;
