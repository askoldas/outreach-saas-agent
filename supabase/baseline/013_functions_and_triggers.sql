alter table public.company_profile_versions
  add constraint company_profile_versions_model_config_fk
  foreign key (analysis_model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.campaign_strategy_versions
  add constraint campaign_strategy_versions_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.qualification_results
  add constraint qualification_results_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

alter table public.outreach_drafts
  add constraint outreach_drafts_model_config_fk
  foreign key (model_config_id) references public.ai_model_configs(id) on delete set null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.is_workspace_admin(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members
    where workspace_id = target_workspace_id
      and user_id = auth.uid()
      and status = 'active'
      and role = 'owner'
  );
$$;

create or replace function public.current_workspace_role(target_workspace_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role
  from public.workspace_members
  where workspace_id = target_workspace_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

create or replace function public.slugify_workspace_name(input text)
returns text
language sql
immutable
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(trim(input)), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.create_workspace(
  workspace_name text,
  workspace_website_url text default null
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  created public.workspaces;
  candidate_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if char_length(trim(coalesce(workspace_name, ''))) not between 2 and 120 then
    raise exception 'Invalid workspace name';
  end if;

  candidate_slug := public.slugify_workspace_name(workspace_name);
  if candidate_slug = '' then candidate_slug := 'workspace'; end if;
  candidate_slug := candidate_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.workspaces (name, slug, website_url, created_by)
  values (
    trim(workspace_name),
    candidate_slug,
    nullif(trim(coalesce(workspace_website_url, '')), ''),
    auth.uid()
  )
  returning * into created;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (created.id, auth.uid(), 'owner');

  return created;
end;
$$;

create or replace function public.create_initial_company_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.company_profiles (workspace_id) values (new.id);
  return new;
end;
$$;

create or replace function public.create_clean_campaign_run(
  target_workspace_id uuid,
  target_campaign_external_id text,
  desired_company_count integer
)
returns public.campaign_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  created_run public.campaign_runs;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select * into target_campaign
  from public.campaigns
  where workspace_id = target_workspace_id
    and external_id = target_campaign_external_id
  for update;

  if target_campaign.id is null then raise exception 'Campaign not found'; end if;
  if target_campaign.current_strategy_version_id is null then
    raise exception 'Campaign Strategy is required';
  end if;
  if target_campaign.profile_snapshot_id is null then
    raise exception 'Campaign Profile snapshot is required';
  end if;

  insert into public.campaign_runs (
    workspace_id, campaign_id, strategy_version_id, profile_snapshot_id,
    status, current_phase, progress_percentage, metadata
  ) values (
    target_workspace_id, target_campaign.id,
    target_campaign.current_strategy_version_id, target_campaign.profile_snapshot_id,
    'queued', 'discovery_queued', 0,
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  )
  returning * into created_run;

  update public.campaign_strategy_versions
  set status = 'used'
  where id = target_campaign.current_strategy_version_id
    and status in ('draft', 'ready');

  insert into public.campaign_run_events (
    workspace_id, campaign_run_id, event_type, phase, summary, details
  ) values (
    target_workspace_id, created_run.id, 'campaign_run_queued', 'discovery_queued',
    'Campaign discovery was queued.',
    jsonb_build_object(
      'desiredCompanyCount',
      greatest(coalesce(desired_company_count, target_campaign.target_volume), 1)
    )
  );

  return created_run;
end;
$$;

create or replace function public.assert_campaign_run_context()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  strategy_campaign uuid;
  strategy_workspace uuid;
  snapshot_campaign uuid;
  snapshot_workspace uuid;
begin
  select campaign_id, workspace_id into strategy_campaign, strategy_workspace
  from public.campaign_strategy_versions where id = new.strategy_version_id;
  select campaign_id, workspace_id into snapshot_campaign, snapshot_workspace
  from public.campaign_profile_snapshots where id = new.profile_snapshot_id;

  if strategy_campaign is distinct from new.campaign_id
     or snapshot_campaign is distinct from new.campaign_id
     or strategy_workspace is distinct from new.workspace_id
     or snapshot_workspace is distinct from new.workspace_id then
    raise exception 'Campaign run context must belong to the same campaign and workspace';
  end if;
  return new;
end;
$$;

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

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

create trigger workspaces_create_initial_company_profile
after insert on public.workspaces
for each row execute function public.create_initial_company_profile();

create trigger campaign_runs_assert_context
before insert or update of workspace_id, campaign_id, strategy_version_id, profile_snapshot_id
on public.campaign_runs
for each row execute function public.assert_campaign_run_context();

create trigger company_profile_versions_assert_workspace
before insert or update of workspace_id, company_profile_id on public.company_profile_versions
for each row execute function public.assert_workspace_consistency();

create trigger campaign_strategy_versions_assert_workspace
before insert or update of workspace_id, campaign_id on public.campaign_strategy_versions
for each row execute function public.assert_workspace_consistency();

create trigger campaign_companies_assert_workspace
before insert or update of workspace_id, campaign_id, company_id on public.campaign_companies
for each row execute function public.assert_workspace_consistency();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'workspaces', 'workspace_members', 'company_profiles', 'campaigns',
    'campaign_runs', 'companies', 'contacts', 'sequences', 'outreach_drafts',
    'documents', 'ai_model_configs', 'ai_guided_drafts', 'ai_conversations'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      table_name || '_set_updated_at',
      table_name
    );
  end loop;
end;
$$;

revoke all on function public.is_workspace_member(uuid) from public, anon;
revoke all on function public.is_workspace_admin(uuid) from public, anon;
revoke all on function public.is_workspace_owner(uuid) from public, anon;
revoke all on function public.current_workspace_role(uuid) from public, anon;
revoke all on function public.create_workspace(text, text) from public, anon;
revoke all on function public.create_clean_campaign_run(uuid, text, integer) from public, anon;
grant execute on function public.is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_admin(uuid) to authenticated, service_role;
grant execute on function public.is_workspace_owner(uuid) to authenticated, service_role;
grant execute on function public.current_workspace_role(uuid) to authenticated, service_role;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.create_clean_campaign_run(uuid, text, integer) to authenticated;
