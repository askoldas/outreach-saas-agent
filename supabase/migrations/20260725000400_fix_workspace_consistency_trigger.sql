create or replace function public.assert_workspace_consistency()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'company_profile_versions' then
    if not exists (
      select 1 from public.company_profiles p
      where p.id = new.company_profile_id and p.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace company profile version';
    end if;
    return new;
  end if;

  if tg_table_name = 'campaign_strategy_versions' then
    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id and c.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace campaign strategy';
    end if;
    return new;
  end if;

  if tg_table_name = 'campaign_companies' then
    if not exists (
      select 1 from public.campaigns c
      where c.id = new.campaign_id and c.workspace_id = new.workspace_id
    ) or not exists (
      select 1 from public.companies c
      where c.id = new.company_id and c.workspace_id = new.workspace_id
    ) then
      raise exception 'Cross-workspace campaign company';
    end if;
    return new;
  end if;

  return new;
end;
$$;
