create table public.company_profile_page_cache_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  canonical_domain text not null,
  url text not null,
  title text not null,
  content text not null,
  content_hash text not null check(length(content_hash)=64),
  extractor_version text not null,
  fetched_at timestamptz not null default now(),
  unique(workspace_id,url,content_hash,extractor_version)
);
create index company_profile_page_cache_v2_lookup_idx on public.company_profile_page_cache_v2(workspace_id,company_profile_id,canonical_domain,extractor_version,fetched_at desc);
alter table public.company_profile_page_cache_v2 enable row level security;
create policy company_profile_page_cache_v2_select on public.company_profile_page_cache_v2
  for select to authenticated using(public.is_workspace_member(workspace_id));
revoke all on public.company_profile_page_cache_v2 from anon,authenticated;
grant select on public.company_profile_page_cache_v2 to authenticated;
