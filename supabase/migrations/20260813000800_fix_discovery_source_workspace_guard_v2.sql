-- Keep the shared tenant guard, but reference child-only record fields only when
-- the trigger is executing for the child reference table.

create or replace function public.validate_discovery_source_expansion_workspace_v2()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.provider_source_records source_record
    join public.discovery_provider_executions execution
      on execution.id = source_record.provider_execution_id
    where source_record.id = new.provider_source_record_id
      and source_record.workspace_id = new.workspace_id
      and source_record.campaign_id = new.campaign_id
      and execution.id = new.provider_execution_id
      and execution.workspace_id = new.workspace_id
      and execution.campaign_id = new.campaign_id
  ) then
    raise exception 'Cross-workspace discovery source expansion.';
  end if;

  if tg_table_name = 'discovery_source_organization_references_v2' then
    if not exists (
      select 1
      from public.discovery_source_expansions_v2 expansion
      where expansion.id = new.source_expansion_id
        and expansion.workspace_id = new.workspace_id
        and expansion.campaign_id = new.campaign_id
        and expansion.provider_execution_id = new.provider_execution_id
        and expansion.provider_source_record_id = new.provider_source_record_id
    ) then
      raise exception 'Cross-workspace discovery source reference.';
    end if;
  end if;

  return new;
end;
$$;

