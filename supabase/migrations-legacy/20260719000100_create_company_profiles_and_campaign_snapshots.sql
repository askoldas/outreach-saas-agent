create table public.company_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  current_version int not null default 1 check (current_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.company_profile_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_id uuid not null references public.company_profiles(id) on delete cascade,
  version int not null check (version > 0),
  company_name text not null check (char_length(trim(company_name)) between 1 and 180),
  website_url text,
  summary text not null default '',
  products_and_services text[] not null default '{}',
  capabilities text[] not null default '{}',
  customer_types text[] not null default '{}',
  differentiators text[] not null default '{}',
  proof_points text[] not null default '{}',
  markets_and_languages text[] not null default '{}',
  claims text[] not null default '{}',
  limitations text[] not null default '{}',
  sources text[] not null default '{}',
  warnings text[] not null default '{}',
  provenance text not null default 'manual' check (provenance in ('manual', 'website_analysis', 'legacy_offer', 'workspace')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (profile_id, version),
  unique (workspace_id, id)
);

create table public.campaign_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null unique references public.campaigns(id) on delete cascade,
  company_profile_version_id uuid not null references public.company_profile_versions(id) on delete restrict,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now()
);

alter table public.campaigns
  alter column offer_external_id drop not null,
  add column company_profile_version_id uuid references public.company_profile_versions(id) on delete restrict;

create index company_profile_versions_workspace_idx on public.company_profile_versions(workspace_id, version desc);
create index campaign_profile_snapshots_workspace_idx on public.campaign_profile_snapshots(workspace_id, campaign_id);
create index campaigns_workspace_profile_version_idx on public.campaigns(workspace_id, company_profile_version_id);

create trigger company_profiles_set_updated_at
before update on public.company_profiles
for each row execute function public.set_updated_at();

alter table public.company_profiles enable row level security;
alter table public.company_profile_versions enable row level security;
alter table public.campaign_profile_snapshots enable row level security;

create policy "Workspace members can read company profiles"
on public.company_profiles for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can manage company profiles"
on public.company_profiles for all to authenticated
using (public.is_workspace_admin(workspace_id))
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read company profile versions"
on public.company_profile_versions for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can insert company profile versions"
on public.company_profile_versions for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

create policy "Workspace members can read campaign profile snapshots"
on public.campaign_profile_snapshots for select to authenticated
using (public.is_workspace_member(workspace_id));

create policy "Workspace admins can insert campaign profile snapshots"
on public.campaign_profile_snapshots for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

insert into public.company_profiles (workspace_id)
select id from public.workspaces
on conflict (workspace_id) do nothing;

insert into public.company_profile_versions (
  workspace_id, profile_id, version, company_name, website_url, summary,
  products_and_services, capabilities, customer_types, differentiators,
  proof_points, markets_and_languages, claims, limitations, sources, warnings,
  provenance, created_by
)
select
  w.id,
  cp.id,
  1,
  w.name,
  w.website_url,
  coalesce(selected_offer.summary, ''),
  case when selected_offer.name is null then '{}'::text[] else array[selected_offer.name] end,
  coalesce(selected_offer.capabilities, '{}'),
  coalesce(selected_offer.buyer_types, '{}'),
  coalesce(selected_offer.differentiators, '{}'),
  coalesce(selected_offer.customer_value, '{}'),
  array[w.default_locale],
  coalesce(selected_offer.customer_value, '{}'),
  coalesce(selected_offer.limitations, '{}'),
  case when w.website_url is null then '{}'::text[] else array[w.website_url] end,
  case
    when selected_offer.id is null then array['Products and services are missing.', 'No approved proof points have been recorded.']
    else coalesce(selected_offer.missing_info, '{}')
  end,
  case when selected_offer.id is null then 'workspace' else 'legacy_offer' end,
  w.created_by
from public.workspaces w
join public.company_profiles cp on cp.workspace_id = w.id
left join lateral (
  select o.* from public.offers o
  where o.workspace_id = w.id
  order by (o.status = 'active') desc, o.updated_at desc
  limit 1
) selected_offer on true
on conflict (profile_id, version) do nothing;

update public.campaigns c
set company_profile_version_id = cpv.id
from public.company_profiles cp
join public.company_profile_versions cpv
  on cpv.profile_id = cp.id and cpv.version = cp.current_version
where cp.workspace_id = c.workspace_id
  and c.company_profile_version_id is null;

insert into public.campaign_profile_snapshots (
  workspace_id, campaign_id, company_profile_version_id, snapshot
)
select
  c.workspace_id,
  c.id,
  cpv.id,
  to_jsonb(cpv) - 'id' - 'workspace_id' - 'profile_id' - 'created_by'
from public.campaigns c
join public.company_profile_versions cpv on cpv.id = c.company_profile_version_id
on conflict (campaign_id) do nothing;

create or replace function public.create_initial_company_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_profile_id uuid;
begin
  insert into public.company_profiles (workspace_id)
  values (new.id)
  returning id into new_profile_id;

  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    markets_and_languages, sources, warnings, provenance, created_by
  ) values (
    new.id, new_profile_id, 1, new.name, new.website_url, '',
    array[new.default_locale],
    case when new.website_url is null then '{}'::text[] else array[new.website_url] end,
    array['Products and services are missing.', 'No approved proof points have been recorded.'],
    'workspace', new.created_by
  );
  return new;
end;
$$;

create trigger workspaces_create_initial_company_profile
after insert on public.workspaces
for each row execute function public.create_initial_company_profile();

create or replace function public.capture_campaign_profile_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_version public.company_profile_versions;
begin
  if new.company_profile_version_id is null then
    select cpv.* into selected_version
    from public.company_profiles cp
    join public.company_profile_versions cpv
      on cpv.profile_id = cp.id and cpv.version = cp.current_version
    where cp.workspace_id = new.workspace_id;
    new.company_profile_version_id := selected_version.id;
  else
    select * into selected_version
    from public.company_profile_versions
    where id = new.company_profile_version_id and workspace_id = new.workspace_id;
  end if;

  if selected_version.id is null then
    raise exception 'Current Company Profile version not found';
  end if;
  return new;
end;
$$;

create trigger campaigns_select_company_profile_version
before insert on public.campaigns
for each row execute function public.capture_campaign_profile_snapshot();

create or replace function public.insert_campaign_profile_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_version public.company_profile_versions;
begin
  select * into selected_version from public.company_profile_versions
  where id = new.company_profile_version_id and workspace_id = new.workspace_id;

  insert into public.campaign_profile_snapshots (
    workspace_id, campaign_id, company_profile_version_id, snapshot
  ) values (
    new.workspace_id,
    new.id,
    selected_version.id,
    to_jsonb(selected_version) - 'id' - 'workspace_id' - 'profile_id' - 'created_by'
  );
  return new;
end;
$$;

create trigger campaigns_insert_company_profile_snapshot
after insert on public.campaigns
for each row execute function public.insert_campaign_profile_snapshot();

create or replace function public.save_company_profile_version(
  target_workspace_id uuid,
  profile_data jsonb
)
returns public.company_profile_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_profile public.company_profiles;
  next_version int;
  saved_version public.company_profile_versions;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required';
  end if;

  select * into target_profile from public.company_profiles
  where workspace_id = target_workspace_id for update;
  if target_profile.id is null then raise exception 'Company Profile not found'; end if;
  next_version := target_profile.current_version + 1;

  insert into public.company_profile_versions (
    workspace_id, profile_id, version, company_name, website_url, summary,
    products_and_services, capabilities, customer_types, differentiators,
    proof_points, markets_and_languages, claims, limitations, sources, warnings,
    provenance, created_by
  ) values (
    target_workspace_id, target_profile.id, next_version,
    trim(coalesce(profile_data->>'companyName', '')),
    nullif(trim(coalesce(profile_data->>'website', '')), ''),
    coalesce(profile_data->>'summary', ''),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'productsAndServices', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'capabilities', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'customerTypes', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'differentiators', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'proofPoints', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'marketsAndLanguages', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'claims', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'limitations', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'sources', '[]'::jsonb))), '{}'),
    coalesce(array(select jsonb_array_elements_text(coalesce(profile_data->'warnings', '[]'::jsonb))), '{}'),
    'manual', auth.uid()
  ) returning * into saved_version;

  update public.company_profiles set current_version = next_version
  where id = target_profile.id;
  return saved_version;
end;
$$;
