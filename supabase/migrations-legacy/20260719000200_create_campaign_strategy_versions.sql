create table public.campaign_strategy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  version int not null check (version > 0),
  status text not null default 'ready' check (status in ('draft', 'ready', 'used', 'superseded')),
  target_geography text not null default '',
  company_types text[] not null default '{}',
  industries text[] not null default '{}',
  characteristics text[] not null default '{}',
  relevance_reasons text[] not null default '{}',
  opportunity_assumptions text[] not null default '{}',
  qualification_criteria text[] not null default '{}',
  positive_signals text[] not null default '{}',
  exclusions text[] not null default '{}',
  contact_roles text[] not null default '{}',
  contact_departments text[] not null default '{}',
  acceptable_contact_routes text[] not null default '{}',
  search_languages text[] not null default '{}',
  source_categories text[] not null default '{}',
  search_terms text[] not null default '{}',
  localized_terms text[] not null default '{}',
  limitations text[] not null default '{}',
  target_company_count int not null default 25 check (target_company_count > 0),
  refinement_summary text[] not null default '{}',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (campaign_id, version),
  unique (workspace_id, id)
);

alter table public.campaigns
  add column current_strategy_version_id uuid references public.campaign_strategy_versions(id) on delete restrict;

alter table public.research_runs
  add column strategy_version_id uuid references public.campaign_strategy_versions(id) on delete restrict;

create index campaign_strategy_versions_workspace_campaign_idx
on public.campaign_strategy_versions(workspace_id, campaign_id, version desc);

create index research_runs_strategy_version_idx
on public.research_runs(strategy_version_id);

alter table public.campaign_strategy_versions enable row level security;

create policy "Workspace members can read campaign strategy versions"
on public.campaign_strategy_versions for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can insert campaign strategy versions"
on public.campaign_strategy_versions for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

insert into public.campaign_strategy_versions (
  workspace_id, campaign_id, version, status, target_geography, company_types,
  industries, relevance_reasons, opportunity_assumptions, qualification_criteria,
  exclusions, contact_roles, contact_departments, acceptable_contact_routes,
  search_languages, source_categories, search_terms, localized_terms, limitations,
  target_company_count, created_by
)
select
  c.workspace_id, c.id, 1,
  case when c.status = 'planning' then 'ready' else 'used' end,
  c.geography, c.target_segments, coalesce(c.industry_terms, '{}'),
  array[c.objective], array['Commercial relevance requires evidence during research'],
  c.strategy_criteria, c.strategy_exclusions,
  array['Relevant decision-maker'], array['Purchasing', 'Partnerships'],
  array['Named business contact', 'Department email', 'General business route'],
  array[c.language], c.strategy_sources, c.strategy_terms,
  c.strategy_localized_terms, c.strategy_limitations,
  coalesce(c.desired_lead_count, greatest(c.lead_count, 25)), c.created_by
from (
  select campaigns.*, workspaces.created_by
  from public.campaigns
  join public.workspaces on workspaces.id = campaigns.workspace_id
) c
on conflict (campaign_id, version) do nothing;

update public.campaigns c
set current_strategy_version_id = csv.id
from public.campaign_strategy_versions csv
where csv.campaign_id = c.id and csv.version = 1
  and c.current_strategy_version_id is null;

update public.research_runs rr
set strategy_version_id = c.current_strategy_version_id
from public.campaigns c
where c.workspace_id = rr.workspace_id
  and c.external_id = rr.campaign_id
  and rr.strategy_version_id is null;

create or replace function public.create_initial_campaign_strategy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  strategy_id uuid;
begin
  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, target_geography, company_types,
    industries, relevance_reasons, opportunity_assumptions, qualification_criteria,
    exclusions, contact_roles, contact_departments, acceptable_contact_routes,
    search_languages, source_categories, search_terms, localized_terms, limitations,
    target_company_count, created_by
  ) values (
    new.workspace_id, new.id, 1, 'ready', new.geography, new.target_segments,
    coalesce(new.industry_terms, '{}'), array[new.objective],
    array['Commercial relevance requires evidence during research'],
    new.strategy_criteria, new.strategy_exclusions,
    array['Relevant decision-maker'], array['Purchasing', 'Partnerships'],
    array['Named business contact', 'Department email', 'General business route'],
    array[new.language], new.strategy_sources, new.strategy_terms,
    new.strategy_localized_terms, new.strategy_limitations,
    coalesce(new.desired_lead_count, greatest(new.lead_count, 25)), auth.uid()
  ) returning id into strategy_id;

  update public.campaigns set current_strategy_version_id = strategy_id where id = new.id;
  return new;
end;
$$;

create trigger campaigns_create_initial_strategy
after insert on public.campaigns
for each row execute function public.create_initial_campaign_strategy();

create or replace function public.save_campaign_strategy_version(
  target_workspace_id uuid,
  target_campaign_external_id text,
  strategy_data jsonb
)
returns public.campaign_strategy_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign public.campaigns;
  next_version int;
  saved_version public.campaign_strategy_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required';
  end if;

  select * into target_campaign from public.campaigns
  where workspace_id = target_workspace_id and external_id = target_campaign_external_id
  for update;
  if target_campaign.id is null then raise exception 'Campaign not found'; end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.campaign_strategy_versions where campaign_id = target_campaign.id;

  update public.campaign_strategy_versions set status = 'superseded'
  where campaign_id = target_campaign.id and status in ('draft', 'ready');

  insert into public.campaign_strategy_versions (
    workspace_id, campaign_id, version, status, target_geography, company_types,
    industries, characteristics, relevance_reasons, opportunity_assumptions,
    qualification_criteria, positive_signals, exclusions, contact_roles,
    contact_departments, acceptable_contact_routes, search_languages,
    source_categories, search_terms, localized_terms, limitations,
    target_company_count, refinement_summary, created_by
  ) values (
    target_workspace_id, target_campaign.id, next_version, 'ready',
    coalesce(strategy_data->>'targetGeography', target_campaign.geography),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'companyTypes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'industries', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'characteristics', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'relevanceReasons', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'opportunityAssumptions', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'qualificationCriteria', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'positiveSignals', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'exclusions', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'contactRoles', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'contactDepartments', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'acceptableContactRoutes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'searchLanguages', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'sourceCategories', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'searchTerms', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'localizedTerms', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'limitations', '[]'::jsonb))), '{}'),
    greatest(coalesce((strategy_data->>'targetCompanyCount')::int, target_campaign.desired_lead_count, 25), 1),
    coalesce(array(select jsonb_array_elements_text(coalesce(strategy_data->'refinementSummary', '[]'::jsonb))), '{}'),
    auth.uid()
  ) returning * into saved_version;

  update public.campaigns set
    current_strategy_version_id = saved_version.id,
    geography = saved_version.target_geography,
    target_segments = saved_version.company_types,
    industry_terms = saved_version.industries,
    strategy_criteria = saved_version.qualification_criteria,
    strategy_exclusions = saved_version.exclusions,
    strategy_sources = saved_version.source_categories,
    strategy_terms = saved_version.search_terms,
    strategy_localized_terms = saved_version.localized_terms,
    strategy_limitations = saved_version.limitations,
    desired_lead_count = saved_version.target_company_count,
    last_activity_label = 'Strategy version saved'
  where id = target_campaign.id;

  return saved_version;
end;
$$;

revoke all on function public.save_campaign_strategy_version(uuid, text, jsonb) from public;
revoke all on function public.save_campaign_strategy_version(uuid, text, jsonb) from anon;
grant execute on function public.save_campaign_strategy_version(uuid, text, jsonb) to authenticated;

create or replace function public.freeze_research_run_strategy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_strategy_id uuid;
begin
  if new.strategy_version_id is null then
    select current_strategy_version_id into selected_strategy_id
    from public.campaigns
    where workspace_id = new.workspace_id and external_id = new.campaign_id;
    new.strategy_version_id := selected_strategy_id;
  end if;

  if new.strategy_version_id is not null then
    if not exists (
      select 1 from public.campaign_strategy_versions
      where id = new.strategy_version_id and workspace_id = new.workspace_id
    ) then raise exception 'Campaign Strategy version not found'; end if;

    update public.campaign_strategy_versions set status = 'used'
    where id = new.strategy_version_id and status in ('draft', 'ready');
  end if;
  return new;
end;
$$;

create trigger research_runs_freeze_strategy
before insert on public.research_runs
for each row execute function public.freeze_research_run_strategy();
