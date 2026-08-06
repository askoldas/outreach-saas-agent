-- WP-22: make Intelligence V2 canonical for every new record while retaining
-- immutable historical V1 records for read and export compatibility.

update public.workspace_intelligence_settings
set
  profile_version = 'v2',
  campaign_workflow = 'v2',
  shadow_mode = false,
  result_write_mode = 'canonical',
  enabled_providers = case
    when 'web' = any(enabled_providers) then enabled_providers
    else array_append(enabled_providers, 'web')
  end,
  updated_at = now();

alter table public.workspace_intelligence_settings
  alter column profile_version set default 'v2',
  alter column campaign_workflow set default 'v2',
  alter column shadow_mode set default false,
  alter column result_write_mode set default 'canonical';

alter table public.company_profile_versions
  alter column intelligence_version set default 'v2';
alter table public.campaigns
  alter column intelligence_version set default 'v2',
  alter column workflow_version set default 'v2';
alter table public.campaign_runs
  alter column workflow_version set default 'v2';

create or replace function public.ensure_workspace_intelligence_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_intelligence_settings (
    workspace_id,
    profile_version,
    campaign_workflow,
    shadow_mode,
    enabled_providers,
    result_write_mode
  ) values (
    new.id,
    'v2',
    'v2',
    false,
    array['web']::text[],
    'canonical'
  )
  on conflict (workspace_id) do nothing;
  return new;
end;
$$;

create or replace function public.enforce_default_v2_legacy_freeze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'workspace_intelligence_settings' then
    if new.profile_version <> 'v2'
      or new.campaign_workflow <> 'v2'
      or new.shadow_mode
      or new.result_write_mode <> 'canonical'
    then
      raise exception
        'Intelligence V2 is the canonical default; V1 and shadow routing are frozen.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'company_profile_versions' then
    if new.intelligence_version <> 'v2' then
      raise exception 'New V1 Company Profile versions are frozen.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'campaigns' then
    if new.intelligence_version <> 'v2' or new.workflow_version <> 'v2' then
      raise exception 'New V1 Campaigns are frozen.'
        using errcode = '23514';
    end if;
  elsif tg_table_name = 'campaign_runs' then
    if new.workflow_version <> 'v2' then
      raise exception 'New V1 Campaign Runs are frozen.'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger workspace_intelligence_settings_v2_only
before insert or update of
  profile_version,
  campaign_workflow,
  shadow_mode,
  result_write_mode
on public.workspace_intelligence_settings
for each row execute function public.enforce_default_v2_legacy_freeze();

create trigger company_profile_versions_v2_only
before insert on public.company_profile_versions
for each row execute function public.enforce_default_v2_legacy_freeze();

create trigger campaigns_v2_only
before insert on public.campaigns
for each row execute function public.enforce_default_v2_legacy_freeze();

create trigger campaign_runs_v2_only
before insert on public.campaign_runs
for each row execute function public.enforce_default_v2_legacy_freeze();

revoke all on function public.rollback_workspace_intelligence_v2(uuid, text)
from public, anon, authenticated;
revoke all on function public.enable_workspace_controlled_beta_v2(
  uuid, boolean, text
) from public, anon, authenticated;

revoke all on function public.enforce_default_v2_legacy_freeze() from public;
