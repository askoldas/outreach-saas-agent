-- WP-23.1: make official-website Company Intelligence V3 the only profile
-- creation path. Historical profile versions remain readable.

create or replace function public.create_native_company_profile_v3_draft(
  target_workspace_id uuid,
  target_input_hash text,
  target_snapshot jsonb,
  target_created_by uuid default auth.uid()
)
returns public.company_profile_drafts
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  workspace_record public.workspaces;
  result public.company_profile_drafts;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select *
  into workspace_record
  from public.workspaces
  where id = target_workspace_id;

  select id
  into profile_id
  from public.company_profiles
  where workspace_id = target_workspace_id;

  if workspace_record.id is null or profile_id is null then
    raise exception 'Company Profile container is missing.';
  end if;
  if nullif(trim(workspace_record.website_url), '') is null then
    raise exception 'A company website is required for native Company Intelligence.';
  end if;
  if length(target_input_hash) is distinct from 64
    or jsonb_typeof(target_snapshot) is distinct from 'object'
    or target_snapshot->>'schemaVersion' is distinct from '3'
    or target_snapshot #>> '{identity,workspaceId}'
      is distinct from target_workspace_id::text
    or target_snapshot #>> '{profileVersionId}' is distinct from profile_id::text
    or target_snapshot #>> '{sourceSet,contractVersion}'
      is distinct from 'company-profile-source-set/v1'
    or target_snapshot #>> '{sourceSet,kind}' is distinct from 'official_website'
    or nullif(trim(target_snapshot #>> '{sourceSet,primaryWebsiteUrl}'), '') is null
    or jsonb_typeof(target_snapshot #> '{sourceSet,allowedDomains}')
      is distinct from 'array'
  then
    raise exception 'Invalid native Company Intelligence source snapshot.';
  end if;
  if jsonb_array_length(target_snapshot #> '{sourceSet,allowedDomains}') = 0 then
    raise exception 'Native Company Intelligence requires an allowed source domain.';
  end if;

  insert into public.company_profile_drafts (
    workspace_id,
    company_profile_id,
    base_version_id,
    state,
    input_hash,
    contract_version,
    source_set_hash,
    compiled_snapshot_json,
    created_by_user_id
  ) values (
    target_workspace_id,
    profile_id,
    null,
    'building',
    target_input_hash,
    'company-intelligence/v3.0',
    encode(digest((target_snapshot->'sourceSet')::text, 'sha256'), 'hex'),
    target_snapshot,
    target_created_by
  )
  on conflict (company_profile_id, input_hash) do update
  set updated_at = public.company_profile_drafts.updated_at
  returning * into result;

  update public.company_profiles
  set current_v3_draft_id = result.id, updated_at = now()
  where id = profile_id;

  return result;
end;
$$;

revoke all on function public.create_native_company_profile_v3_draft(
  uuid, text, jsonb, uuid
) from public, anon;
grant execute on function public.create_native_company_profile_v3_draft(
  uuid, text, jsonb, uuid
) to authenticated, service_role;

-- The generic adapter-era draft constructor and both V1 profile writers are
-- retained only as historical schema. They can no longer create canonical data.
revoke all on function public.create_company_profile_v3_draft(
  uuid, uuid, text, jsonb, uuid
) from authenticated, service_role;
revoke all on function public.save_clean_company_profile_version(
  uuid, jsonb, jsonb, jsonb, text
) from authenticated, service_role;
revoke all on function public.save_analyzed_company_profile_version(
  uuid, uuid, jsonb, jsonb, jsonb, text
) from authenticated, service_role;

create or replace function public.require_native_company_intelligence_v3_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.intelligence_version = 'v2'
    and (
      jsonb_typeof(new.structured_profile) is distinct from 'object'
      or new.structured_profile->>'schemaVersion' is distinct from '3'
      or jsonb_typeof(new.structured_profile->'commercialSynthesis')
        is distinct from 'object'
      or jsonb_typeof(new.structured_profile->'offerings')
        is distinct from 'object'
      or jsonb_typeof(new.structured_profile #> '{offerings,offerings}')
        is distinct from 'array'
      or new.structured_profile #>> '{sourceSet,contractVersion}'
        is distinct from 'company-profile-source-set/v1'
      or new.structured_profile #>> '{sourceSet,kind}'
        is distinct from 'official_website'
      or nullif(
        trim(new.structured_profile #>> '{sourceSet,primaryWebsiteUrl}'),
        ''
      ) is null
    )
  then
    raise exception
      'Canonical Company Profile versions must come from native Company Intelligence V3.';
  end if;
  return new;
end;
$$;

drop trigger if exists company_profile_versions_require_native_v3
on public.company_profile_versions;
create trigger company_profile_versions_require_native_v3
before insert on public.company_profile_versions
for each row
execute function public.require_native_company_intelligence_v3_version();

revoke all on function
  public.require_native_company_intelligence_v3_version()
from public, anon, authenticated, service_role;
