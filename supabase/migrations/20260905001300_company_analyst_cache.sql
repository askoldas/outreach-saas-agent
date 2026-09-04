create table public.company_analyst_cache_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_profile_id uuid not null references public.company_profiles(id) on delete cascade,
  cache_key text not null,
  result_json jsonb not null,
  evidence_manifest_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(workspace_id, cache_key)
);
alter table public.company_analyst_cache_v2 enable row level security;
create policy company_analyst_cache_v2_select on public.company_analyst_cache_v2
  for select to authenticated using(public.is_workspace_member(workspace_id));
revoke all on public.company_analyst_cache_v2 from anon,authenticated;
grant select on public.company_analyst_cache_v2 to authenticated;
