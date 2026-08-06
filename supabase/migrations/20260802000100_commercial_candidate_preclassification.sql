-- Frozen commercial candidate dispositions between provider normalization and Entity Resolution.

create table public.provider_candidate_preclassifications_v2 (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  provider_execution_id uuid not null
    references public.discovery_provider_executions(id) on delete cascade,
  provider_source_record_id uuid not null
    references public.provider_source_records(id) on delete cascade,
  disposition text not null check (
    disposition in ('candidate', 'source_only', 'reject', 'needs_review')
  ),
  probable_organization_type text not null,
  probable_relationship_types_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(probable_relationship_types_json) = 'array'),
  objective_compatibility text not null check (
    objective_compatibility in ('compatible', 'incompatible', 'unknown')
  ),
  geography_plausible boolean,
  matched_segment_key text not null,
  matched_archetype_key text not null,
  campaign_strategy_version_id uuid not null
    references public.campaign_strategy_versions(id) on delete restrict,
  positive_signals_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(positive_signals_json) = 'array'),
  negative_signals_json jsonb not null default '[]'::jsonb
    check (jsonb_typeof(negative_signals_json) = 'array'),
  reason_codes_json jsonb not null
    check (jsonb_typeof(reason_codes_json) = 'array' and jsonb_array_length(reason_codes_json) > 0),
  source_evidence_ids_json jsonb not null
    check (jsonb_typeof(source_evidence_ids_json) = 'array'),
  confidence numeric not null check (confidence between 0 and 1),
  classifier_version text not null,
  input_hash text not null check (length(input_hash) = 64),
  created_at timestamptz not null default now(),
  unique (provider_source_record_id, classifier_version)
);

create index provider_candidate_preclassifications_run_idx
on public.provider_candidate_preclassifications_v2(
  workspace_id, campaign_id, provider_execution_id, disposition
);

alter table public.provider_candidate_preclassifications_v2 enable row level security;
create policy "Members can read provider candidate preclassifications"
on public.provider_candidate_preclassifications_v2 for select to authenticated
using (public.is_workspace_member(workspace_id));

create trigger provider_candidate_preclassifications_v2_immutable
before update on public.provider_candidate_preclassifications_v2
for each row execute function public.reject_discovery_provider_update();

create or replace function public.persist_provider_candidate_preclassifications_v2(
  target_workspace_id uuid,
  target_execution_id uuid,
  target_classifications jsonb
)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  target_execution public.discovery_provider_executions;
  classification jsonb;
  source_record public.provider_source_records;
  inserted_count integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  select * into target_execution
  from public.discovery_provider_executions
  where id = target_execution_id and workspace_id = target_workspace_id;
  if target_execution.id is null then raise exception 'Provider execution not found.'; end if;
  if jsonb_array_length(target_classifications) <> target_execution.result_count then
    raise exception 'Every provider source requires exactly one preclassification.';
  end if;
  for classification in select * from jsonb_array_elements(target_classifications) loop
    select * into source_record
    from public.provider_source_records
    where provider_execution_id = target_execution_id
      and source_record_key = classification->>'sourceRecordKey';
    if source_record.id is null then raise exception 'Preclassification references an unknown source.'; end if;
    insert into public.provider_candidate_preclassifications_v2 (
      workspace_id, campaign_id, provider_execution_id, provider_source_record_id,
      disposition, probable_organization_type, probable_relationship_types_json,
      objective_compatibility, geography_plausible, matched_segment_key,
      matched_archetype_key, campaign_strategy_version_id, positive_signals_json,
      negative_signals_json, reason_codes_json, source_evidence_ids_json,
      confidence, classifier_version, input_hash
    ) values (
      target_workspace_id, target_execution.campaign_id, target_execution_id,
      source_record.id, classification->>'disposition',
      classification->>'probableOrganizationType',
      coalesce(classification->'probableRelationshipTypes', '[]'::jsonb),
      classification->>'objectiveCompatibility',
      (classification->>'geographyPlausible')::boolean,
      classification->>'matchedSegmentId', classification->>'matchedArchetypeId',
      (classification->>'strategyVersionId')::uuid,
      coalesce(classification->'positiveSignals', '[]'::jsonb),
      coalesce(classification->'negativeSignals', '[]'::jsonb),
      classification->'reasonCodes', classification->'sourceEvidenceIds',
      (classification->>'confidence')::numeric,
      classification->>'classifierVersion',
      encode(extensions.digest(classification::text, 'sha256'), 'hex')
    ) on conflict (provider_source_record_id, classifier_version) do nothing;
    inserted_count := inserted_count + 1;
  end loop;
  return inserted_count;
end;
$$;

revoke all on function public.persist_provider_candidate_preclassifications_v2(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.persist_provider_candidate_preclassifications_v2(
  uuid, uuid, jsonb
) to service_role;
