create table public.company_intelligence_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  source_candidate_intelligence_version_id uuid not null
    references public.candidate_intelligence_versions(id) on delete restrict,
  version integer not null check (version > 0),
  intelligence_json jsonb not null check (jsonb_typeof(intelligence_json) = 'object'),
  research_blueprint_version_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(research_blueprint_version_ids) = 'array'),
  evidence_ids jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_ids) = 'array'),
  confidence numeric not null check (confidence between 0 and 1),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, organization_id, version),
  unique (workspace_id, organization_id, input_hash, schema_version, compiler_version),
  unique (workspace_id, id)
);

create index company_intelligence_versions_v2_organization_idx
  on public.company_intelligence_versions_v2(workspace_id, organization_id, version desc);

alter table public.company_intelligence_versions_v2 enable row level security;
create policy company_intelligence_versions_v2_select
  on public.company_intelligence_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.assert_company_intelligence_artifact_workspace_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.companies organization
    join public.candidate_intelligence_versions source_version
      on source_version.id = new.source_candidate_intelligence_version_id
     and source_version.organization_id = organization.id
     and source_version.workspace_id = organization.workspace_id
    where organization.id = new.organization_id
      and organization.workspace_id = new.workspace_id
  ) then
    raise exception 'Company Intelligence artifact workspace or source mismatch.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(new.research_blueprint_version_ids)
      as blueprint_id(value)
    where not exists (
      select 1 from public.research_blueprint_versions_v2 blueprint
      where blueprint.id = blueprint_id.value::uuid
        and blueprint.workspace_id = new.workspace_id
    )
  ) then
    raise exception 'Company Intelligence Research Blueprint workspace mismatch.';
  end if;
  return new;
end;
$$;

create trigger company_intelligence_versions_v2_workspace_guard
before insert on public.company_intelligence_versions_v2
for each row execute function public.assert_company_intelligence_artifact_workspace_v2();

create trigger company_intelligence_versions_v2_immutable
before update or delete on public.company_intelligence_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();

revoke all on public.company_intelligence_versions_v2 from anon, authenticated;
grant select on public.company_intelligence_versions_v2 to authenticated;
