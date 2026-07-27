create table public.intelligence_contracts (
  id uuid primary key default gen_random_uuid(),
  contract_key text not null check (length(trim(contract_key)) > 0),
  version text not null check (length(trim(version)) > 0),
  json_schema jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'deprecated', 'retired')),
  content_hash text not null check (length(trim(content_hash)) > 0),
  created_at timestamptz not null default now(),
  unique (contract_key, version)
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null check (length(trim(prompt_key)) > 0),
  version text not null check (length(trim(version)) > 0),
  role text not null check (length(trim(role)) > 0),
  contract_id uuid not null references public.intelligence_contracts(id) on delete restrict,
  system_template text not null,
  user_template text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'deprecated', 'retired')),
  content_hash text not null check (length(trim(content_hash)) > 0),
  change_notes text,
  created_at timestamptz not null default now(),
  unique (prompt_key, version)
);

create table public.workflow_versions (
  id uuid primary key default gen_random_uuid(),
  workflow_family text not null check (length(trim(workflow_family)) > 0),
  version text not null check (length(trim(version)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'deprecated', 'retired')),
  change_notes text,
  created_at timestamptz not null default now(),
  unique (workflow_family, version)
);

create table public.scoring_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (length(trim(version)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'deprecated', 'retired')),
  formula_json jsonb not null,
  lane_policy_json jsonb not null,
  confidence_policy_json jsonb not null,
  content_hash text not null check (length(trim(content_hash)) > 0),
  created_at timestamptz not null default now()
);

create table public.provider_adapters (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null check (length(trim(provider_key)) > 0),
  adapter_version text not null check (length(trim(adapter_version)) > 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'deprecated', 'retired')),
  configuration_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_key, adapter_version)
);

create or replace function public.prevent_intelligence_registry_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Intelligence registry records are immutable; create a new version.';
end;
$$;

create trigger intelligence_contracts_immutable
before update or delete on public.intelligence_contracts
for each row execute function public.prevent_intelligence_registry_mutation();

create trigger prompt_versions_immutable
before update or delete on public.prompt_versions
for each row execute function public.prevent_intelligence_registry_mutation();

create trigger workflow_versions_immutable
before update or delete on public.workflow_versions
for each row execute function public.prevent_intelligence_registry_mutation();

create trigger scoring_versions_immutable
before update or delete on public.scoring_versions
for each row execute function public.prevent_intelligence_registry_mutation();

create trigger provider_adapters_immutable
before update or delete on public.provider_adapters
for each row execute function public.prevent_intelligence_registry_mutation();

alter table public.intelligence_contracts enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.workflow_versions enable row level security;
alter table public.scoring_versions enable row level security;
alter table public.provider_adapters enable row level security;

create policy "Authenticated users can read intelligence contracts"
on public.intelligence_contracts for select to authenticated using (true);
create policy "Authenticated users can read prompt versions"
on public.prompt_versions for select to authenticated using (true);
create policy "Authenticated users can read workflow versions"
on public.workflow_versions for select to authenticated using (true);
create policy "Authenticated users can read scoring versions"
on public.scoring_versions for select to authenticated using (true);
create policy "Authenticated users can read provider adapters"
on public.provider_adapters for select to authenticated using (true);

revoke insert, update, delete on public.intelligence_contracts from anon, authenticated;
revoke insert, update, delete on public.prompt_versions from anon, authenticated;
revoke insert, update, delete on public.workflow_versions from anon, authenticated;
revoke insert, update, delete on public.scoring_versions from anon, authenticated;
revoke insert, update, delete on public.provider_adapters from anon, authenticated;

insert into public.workflow_versions (
  workflow_family,
  version,
  status,
  change_notes
) values
  ('campaign', 'v1', 'active', 'Legacy campaign workflow retained during V2 rollout.'),
  ('campaign', 'v2', 'draft', 'Intelligence V2 campaign workflow; not yet dispatchable.');

