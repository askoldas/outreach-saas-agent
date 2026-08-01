-- The organization graph workspace guard is shared by tables with different
-- row shapes. Keep table-specific NEW field access inside its own PL/pgSQL
-- branch so PostgreSQL does not bind a missing field for another table.

create or replace function public.validate_organization_graph_workspace()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  expected_workspace_id uuid;
begin
  if tg_table_name in (
    'organization_aliases',
    'organization_identifiers',
    'organization_locations',
    'organization_source_links'
  ) then
    select workspace_id into expected_workspace_id
    from public.companies
    where id = new.organization_id;

    if tg_table_name = 'organization_source_links' then
      if not exists (
        select 1
        from public.provider_source_records
        where id = new.provider_source_record_id
          and workspace_id = expected_workspace_id
      ) then
        raise exception 'Cross-workspace organization source link.';
      end if;
    end if;
  elsif tg_table_name = 'organization_relationships' then
    select workspace_id into expected_workspace_id
    from public.companies
    where id = new.source_organization_id;
    if not exists (
      select 1
      from public.companies
      where id = new.target_organization_id
        and workspace_id = expected_workspace_id
    ) then
      raise exception 'Cross-workspace organization relationship.';
    end if;
  elsif tg_table_name = 'organization_buying_hypotheses' then
    select workspace_id into expected_workspace_id
    from public.companies
    where id = new.target_organization_id;
    if not exists (
      select 1
      from public.companies
      where id = new.buying_organization_id
        and workspace_id = expected_workspace_id
    ) then
      raise exception 'Cross-workspace buying organization.';
    end if;
  elsif tg_table_name = 'organization_merge_events' then
    select workspace_id into expected_workspace_id
    from public.companies
    where id = new.source_organization_id;
    if not exists (
      select 1
      from public.companies
      where id = new.target_organization_id
        and workspace_id = expected_workspace_id
    ) then
      raise exception 'Cross-workspace organization merge.';
    end if;
  elsif tg_table_name = 'entity_resolution_cases' then
    select workspace_id into expected_workspace_id
    from public.normalized_provider_candidates
    where id = new.normalized_candidate_id;
  elsif tg_table_name = 'entity_match_assessments' then
    select workspace_id into expected_workspace_id
    from public.entity_resolution_cases
    where id = new.resolution_case_id;
    if not exists (
      select 1
      from public.companies
      where id = new.candidate_organization_id
        and workspace_id = expected_workspace_id
    ) then
      raise exception 'Cross-workspace entity match assessment.';
    end if;
  elsif tg_table_name = 'entity_resolution_decisions' then
    select workspace_id into expected_workspace_id
    from public.entity_resolution_cases
    where id = new.resolution_case_id;
    if not exists (
      select 1
      from public.normalized_provider_candidates
      where id = new.normalized_candidate_id
        and workspace_id = expected_workspace_id
    ) then
      raise exception 'Cross-workspace entity resolution decision.';
    end if;
  elsif tg_table_name = 'organization_split_events' then
    select workspace_id into expected_workspace_id
    from public.organization_merge_events
    where id = new.merge_event_id;
  else
    raise exception 'Unsupported organization graph workspace guard.';
  end if;

  if expected_workspace_id is null
    or expected_workspace_id <> new.workspace_id
  then
    raise exception 'Organization graph workspace mismatch.';
  end if;
  return new;
end;
$$;
