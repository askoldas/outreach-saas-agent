alter table public.discovery_candidates
  add column candidate_key text;

update public.discovery_candidates
set candidate_key = coalesce(
  nullif(normalized_domain, ''),
  nullif(lower(regexp_replace(split_part(source_url, '?', 1), '/+$', '')), ''),
  lower(trim(company_name)) || '|' || lower(coalesce(country_region, ''))
);

alter table public.discovery_candidates
  alter column candidate_key set not null;

create table public.discovery_candidate_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_run_id uuid not null references public.campaign_runs(id) on delete cascade,
  candidate_id uuid not null references public.discovery_candidates(id) on delete cascade,
  discovery_query_id uuid not null references public.discovery_queries(id) on delete restrict,
  source_url text not null,
  source_query text not null,
  source_path text not null,
  snippet text not null default '',
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (candidate_id, discovery_query_id, source_url),
  unique (workspace_id, id)
);

insert into public.discovery_candidate_evidence (
  workspace_id,
  campaign_run_id,
  candidate_id,
  discovery_query_id,
  source_url,
  source_query,
  source_path,
  snippet,
  retrieved_at
)
select
  workspace_id,
  campaign_run_id,
  id,
  discovery_query_id,
  source_url,
  source_query,
  source_path,
  snippet,
  retrieved_at
from public.discovery_candidates
on conflict do nothing;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by campaign_run_id, discovery_iteration_id, candidate_key
      order by created_at, id
    ) as keeper_id
  from public.discovery_candidates
),
duplicates as (
  select id, keeper_id from ranked where id <> keeper_id
)
delete from public.candidate_classifications duplicate_classification
using duplicates
where duplicate_classification.candidate_id = duplicates.id
  and exists (
    select 1
    from public.candidate_classifications keeper_classification
    where keeper_classification.candidate_id = duplicates.keeper_id
      and keeper_classification.input_hash = duplicate_classification.input_hash
  );

with ranked as (
  select
    id,
    first_value(id) over (
      partition by campaign_run_id, discovery_iteration_id, candidate_key
      order by created_at, id
    ) as keeper_id
  from public.discovery_candidates
),
duplicates as (
  select id, keeper_id from ranked where id <> keeper_id
)
update public.candidate_classifications classification
set candidate_id = duplicates.keeper_id
from duplicates
where classification.candidate_id = duplicates.id;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by campaign_run_id, discovery_iteration_id, candidate_key
      order by created_at, id
    ) as keeper_id
  from public.discovery_candidates
),
duplicates as (
  select id, keeper_id from ranked where id <> keeper_id
)
insert into public.discovery_candidate_evidence (
  workspace_id,
  campaign_run_id,
  candidate_id,
  discovery_query_id,
  source_url,
  source_query,
  source_path,
  snippet,
  retrieved_at
)
select
  evidence.workspace_id,
  evidence.campaign_run_id,
  duplicates.keeper_id,
  evidence.discovery_query_id,
  evidence.source_url,
  evidence.source_query,
  evidence.source_path,
  evidence.snippet,
  evidence.retrieved_at
from public.discovery_candidate_evidence evidence
join duplicates on duplicates.id = evidence.candidate_id
on conflict do nothing;

with ranked as (
  select
    id,
    first_value(id) over (
      partition by campaign_run_id, discovery_iteration_id, candidate_key
      order by created_at, id
    ) as keeper_id
  from public.discovery_candidates
),
duplicates as (
  select id, keeper_id from ranked where id <> keeper_id
)
delete from public.discovery_candidate_evidence evidence
using duplicates
where evidence.candidate_id = duplicates.id;

with ranked as (
  select
    id,
    row_number() over (
      partition by campaign_run_id, discovery_iteration_id, candidate_key
      order by created_at, id
    ) as duplicate_rank
  from public.discovery_candidates
)
delete from public.discovery_candidates candidate
using ranked
where candidate.id = ranked.id
  and ranked.duplicate_rank > 1;

alter table public.discovery_candidates
  add constraint discovery_candidates_iteration_identity_unique
  unique (campaign_run_id, discovery_iteration_id, candidate_key);

alter table public.discovery_candidate_evidence enable row level security;

create policy discovery_candidate_evidence_select
  on public.discovery_candidate_evidence
  for select to authenticated
  using (public.is_workspace_member(workspace_id));

create index discovery_candidate_evidence_candidate_idx
  on public.discovery_candidate_evidence(candidate_id, created_at);

create or replace function public.resolve_discovered_company(
  target_workspace_id uuid,
  company_name_value text,
  normalized_name_value text,
  website_url_value text,
  country_value text,
  description_value text,
  metadata_value jsonb,
  normalized_domain_value text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_company_id uuid;
  inserted_company_id uuid;
  inserted_domain_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if nullif(normalized_domain_value, '') is not null then
    select company_id into resolved_company_id
    from public.company_domains
    where workspace_id = target_workspace_id
      and normalized_domain = normalized_domain_value;

    if resolved_company_id is not null then
      return resolved_company_id;
    end if;
  else
    select id into resolved_company_id
    from public.companies
    where workspace_id = target_workspace_id
      and normalized_name = normalized_name_value
      and coalesce(country, '') = coalesce(country_value, '')
      and website_url is null
    order by created_at
    limit 1;

    if resolved_company_id is not null then
      return resolved_company_id;
    end if;
  end if;

  insert into public.companies (
    workspace_id,
    name,
    normalized_name,
    website_url,
    country,
    description,
    metadata
  ) values (
    target_workspace_id,
    company_name_value,
    normalized_name_value,
    website_url_value,
    country_value,
    description_value,
    metadata_value
  )
  returning id into inserted_company_id;

  if nullif(normalized_domain_value, '') is null then
    return inserted_company_id;
  end if;

  insert into public.company_domains (
    workspace_id,
    company_id,
    domain,
    normalized_domain,
    is_primary,
    verification_status,
    metadata
  ) values (
    target_workspace_id,
    inserted_company_id,
    normalized_domain_value,
    normalized_domain_value,
    true,
    'source_confirmed',
    jsonb_build_object('sourceUrl', website_url_value)
  )
  on conflict (workspace_id, normalized_domain) do nothing
  returning id into inserted_domain_id;

  if inserted_domain_id is not null then
    return inserted_company_id;
  end if;

  select company_id into resolved_company_id
  from public.company_domains
  where workspace_id = target_workspace_id
    and normalized_domain = normalized_domain_value;

  delete from public.companies where id = inserted_company_id;
  return resolved_company_id;
end;
$$;

revoke all on function public.resolve_discovered_company(
  uuid,text,text,text,text,text,jsonb,text
) from public, anon, authenticated;
grant execute on function public.resolve_discovered_company(
  uuid,text,text,text,text,text,jsonb,text
) to service_role;

create unique index campaign_contacts_association_unique
  on public.campaign_contacts(
    campaign_company_id,
    contact_id,
    contact_method_id
  ) nulls not distinct;

create unique index contact_sources_method_provenance_unique
  on public.contact_sources(contact_method_id, provider, source_url)
  where contact_method_id is not null;
