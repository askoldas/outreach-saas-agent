create table public.commercial_relationship_assessment_versions_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.companies(id) on delete cascade,
  company_intelligence_version_id uuid not null
    references public.company_intelligence_versions_v2(id) on delete restrict,
  campaign_target_model_version_id uuid not null
    references public.campaign_target_model_versions_v2(id) on delete restrict,
  version integer not null check (version > 0),
  matched_archetype_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(matched_archetype_ids) = 'array'),
  assessment_json jsonb not null check (jsonb_typeof(assessment_json) = 'object'),
  input_hash text not null check (length(input_hash) = 64),
  content_hash text not null check (length(content_hash) = 64),
  schema_version text not null,
  compiler_version text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, campaign_id, organization_id, version),
  unique (workspace_id, campaign_id, organization_id, input_hash, schema_version, compiler_version),
  unique (workspace_id, id)
);

create index commercial_relationship_assessments_v2_lookup_idx
  on public.commercial_relationship_assessment_versions_v2(
    workspace_id, campaign_id, organization_id, version desc
  );

alter table public.commercial_relationship_assessment_versions_v2 enable row level security;
create policy commercial_relationship_assessments_v2_select
  on public.commercial_relationship_assessment_versions_v2 for select to authenticated
  using (public.is_workspace_member(workspace_id));

create or replace function public.assert_commercial_relationship_assessment_workspace_v2()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1
    from public.company_intelligence_versions_v2 intelligence
    join public.campaign_target_model_versions_v2 target
      on target.id = new.campaign_target_model_version_id
     and target.workspace_id = intelligence.workspace_id
    where intelligence.id = new.company_intelligence_version_id
      and intelligence.workspace_id = new.workspace_id
      and intelligence.organization_id = new.organization_id
      and target.campaign_id = new.campaign_id
  ) then
    raise exception 'Commercial Relationship assessment input mismatch.';
  end if;
  return new;
end;
$$;

create trigger commercial_relationship_assessments_v2_workspace_guard
before insert on public.commercial_relationship_assessment_versions_v2
for each row execute function public.assert_commercial_relationship_assessment_workspace_v2();

create trigger commercial_relationship_assessments_v2_immutable
before update or delete on public.commercial_relationship_assessment_versions_v2
for each row execute function public.reject_core_intelligence_artifact_mutation_v2();

revoke all on public.commercial_relationship_assessment_versions_v2
  from anon, authenticated;
grant select on public.commercial_relationship_assessment_versions_v2 to authenticated;
