create table public.company_target_roles_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  profile_draft_id uuid not null references public.company_profile_drafts(id) on delete cascade,
  role_key text not null,
  label text not null,
  offering_keys text[] not null default '{}',
  archetype_keys text[] not null default '{}',
  confidence numeric(5,4) not null check (confidence between 0 and 1),
  evidence_ids uuid[] not null default '{}',
  origin text not null default 'company_intelligence',
  created_at timestamptz not null default now(),
  unique(profile_draft_id, role_key)
);
alter table public.company_target_roles_v2 enable row level security;
create policy company_target_roles_v2_select on public.company_target_roles_v2
  for select to authenticated using (public.is_workspace_member(workspace_id));
revoke all on public.company_target_roles_v2 from anon, authenticated;
grant select on public.company_target_roles_v2 to authenticated;

alter table public.organization_relationship_memories_v2
  add column if not exists profile_draft_id uuid references public.company_profile_drafts(id) on delete cascade;

create or replace function public.persist_company_profile_commercial_extensions_v2(
  target_workspace_id uuid, target_profile_draft_id uuid, target_compilation jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare target_record jsonb; relationship_record jsonb; profile_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required.'; end if;
  select company_profile_id into profile_id from public.company_profile_drafts
    where id=target_profile_draft_id and workspace_id=target_workspace_id;
  if profile_id is null then raise exception 'Company Intelligence draft was not found.'; end if;

  delete from public.company_target_roles_v2
    where workspace_id=target_workspace_id and profile_draft_id=target_profile_draft_id;
  for target_record in select value from jsonb_array_elements(coalesce(target_compilation->'targetRoles','[]'::jsonb)) loop
    insert into public.company_target_roles_v2(workspace_id,profile_draft_id,role_key,label,offering_keys,archetype_keys,confidence,evidence_ids)
    values(target_workspace_id,target_profile_draft_id,target_record->>'roleKey',target_record->>'label',
      array(select jsonb_array_elements_text(coalesce(target_record->'offeringKeys','[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(target_record->'archetypeKeys','[]'::jsonb))),
      coalesce((target_record->>'confidence')::numeric,0),
      array(select jsonb_array_elements_text(coalesce(target_record->'evidenceIds','[]'::jsonb)))::uuid[]);
  end loop;

  delete from public.organization_relationship_memories_v2
    where workspace_id=target_workspace_id and profile_draft_id=target_profile_draft_id
      and source in ('company_profile','seller_site','other');
  for relationship_record in select value from jsonb_array_elements(coalesce(target_compilation->'knownRelationships','[]'::jsonb)) loop
    insert into public.organization_relationship_memories_v2(
      workspace_id,profile_draft_id,organization_name,canonical_domain,relationship_type,status,
      confidence,evidence_ids,source,scope,scope_id)
    values(target_workspace_id,target_profile_draft_id,relationship_record->>'organizationName',
      nullif(lower(relationship_record->>'canonicalDomain'),''),
      case when relationship_record->>'relationshipType'='distributor' then 'partner'
           when relationship_record->>'relationshipType'='other' then 'unknown'
           else relationship_record->>'relationshipType' end,
      relationship_record->>'status',coalesce((relationship_record->>'confidence')::numeric,0),
      array(select jsonb_array_elements_text(coalesce(relationship_record->'evidenceIds','[]'::jsonb))),
      relationship_record->>'source','company',profile_id);
  end loop;
end; $$;
revoke all on function public.persist_company_profile_commercial_extensions_v2(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_company_profile_commercial_extensions_v2(uuid,uuid,jsonb) to service_role;
