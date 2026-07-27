create or replace function public.publish_company_profile_v3_draft(
  target_workspace_id uuid,
  target_profile_draft_id uuid
)
returns public.company_profile_versions
language plpgsql security definer set search_path = public
as $$
declare
  draft_record public.company_profile_drafts;
  published_version public.company_profile_versions;
  next_version integer;
  draft_model public.company_business_models;
  published_model_id uuid;
  draft_offering public.company_offering_versions;
  published_offering_id uuid;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;

  select * into draft_record
  from public.company_profile_drafts
  where workspace_id = target_workspace_id
    and id = target_profile_draft_id
  for update;
  if draft_record.id is null then
    raise exception 'Company Intelligence draft was not found.';
  end if;
  if draft_record.state <> 'ready_for_review' then
    raise exception 'Company Intelligence draft is not ready for publication.';
  end if;
  if exists (
    select 1 from public.profile_clarification_questions
    where workspace_id = target_workspace_id
      and profile_draft_id = target_profile_draft_id
      and status = 'pending'
      and impact = 'blocking'
      and skip_allowed = false
  ) then
    raise exception 'Blocking clarification questions must be answered.';
  end if;
  if not exists (
    select 1 from public.company_business_models
    where workspace_id = target_workspace_id
      and profile_draft_id = target_profile_draft_id
  ) then
    raise exception 'A reviewed business model is required.';
  end if;
  if not exists (
    select 1 from public.company_offering_versions
    where workspace_id = target_workspace_id
      and profile_draft_id = target_profile_draft_id
      and status = 'active'
  ) then
    raise exception 'At least one active offering is required.';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from public.company_profile_versions
  where company_profile_id = draft_record.company_profile_id;

  insert into public.company_profile_versions (
    workspace_id, company_profile_id, version, company_name, website_url,
    summary, structured_profile, extracted_facts, review_questions,
    profile_status, readiness_score, provenance, created_by,
    intelligence_version
  ) values (
    target_workspace_id,
    draft_record.company_profile_id,
    next_version,
    coalesce(draft_record.compiled_snapshot_json #>> '{identity,publicName}', ''),
    case
      when nullif(draft_record.compiled_snapshot_json #>> '{identity,canonicalDomain}', '') is null
        then null
      else 'https://' || (draft_record.compiled_snapshot_json #>> '{identity,canonicalDomain}')
    end,
    coalesce(
      draft_record.compiled_snapshot_json #>> '{commercialSynthesis,conciseCommercialSummary}',
      ''
    ),
    jsonb_set(
      draft_record.compiled_snapshot_json,
      '{status}',
      '"published"'::jsonb,
      true
    ),
    '[]'::jsonb,
    '[]'::jsonb,
    'published',
    100,
    'manual',
    auth.uid(),
    'v2'
  )
  returning * into published_version;

  select * into draft_model
  from public.company_business_models
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;

  insert into public.company_business_models (
    workspace_id, profile_version_id, primary_role, revenue_model,
    transaction_model, customer_usage_mode, sales_motion,
    structured_details_json, confidence
  ) values (
    target_workspace_id, published_version.id, draft_model.primary_role,
    draft_model.revenue_model, draft_model.transaction_model,
    draft_model.customer_usage_mode, draft_model.sales_motion,
    draft_model.structured_details_json, draft_model.confidence
  )
  returning id into published_model_id;

  insert into public.company_business_roles (
    workspace_id, business_model_id, role_type, priority, confidence,
    claim_id, explanation, evidence_ids
  )
  select
    target_workspace_id, published_model_id, role_type, priority, confidence,
    claim_id, explanation, evidence_ids
  from public.company_business_roles
  where workspace_id = target_workspace_id
    and business_model_id = draft_model.id;

  for draft_offering in
    select * from public.company_offering_versions
    where workspace_id = target_workspace_id
      and profile_draft_id = target_profile_draft_id
  loop
    insert into public.company_offering_versions (
      workspace_id, company_offering_id, profile_version_id, slug, name,
      status, offering_type, short_description, commercial_mechanics_json,
      buyer_logic_json, relationship_options_json, availability_json,
      constraints_json, confidence, claim_ids, evidence_ids
    ) values (
      target_workspace_id, draft_offering.company_offering_id,
      published_version.id, draft_offering.slug, draft_offering.name,
      draft_offering.status, draft_offering.offering_type,
      draft_offering.short_description, draft_offering.commercial_mechanics_json,
      draft_offering.buyer_logic_json, draft_offering.relationship_options_json,
      draft_offering.availability_json, draft_offering.constraints_json,
      draft_offering.confidence, draft_offering.claim_ids,
      draft_offering.evidence_ids
    )
    returning id into published_offering_id;

    insert into public.buyer_archetype_hypotheses (
      workspace_id, profile_version_id, offering_version_id, archetype_key,
      name, relationship_type, priority, status, structured_details_json,
      confidence, claim_ids, evidence_ids
    )
    select
      target_workspace_id, published_version.id, published_offering_id,
      archetype_key, name, relationship_type, priority, status,
      structured_details_json, confidence, claim_ids, evidence_ids
    from public.buyer_archetype_hypotheses
    where workspace_id = target_workspace_id
      and profile_draft_id = target_profile_draft_id
      and offering_version_id = draft_offering.id;
  end loop;

  insert into public.commercial_rules (
    workspace_id, profile_version_id, rule_key, scope, scope_id, rule_type,
    strength, status, source, description, applicability_json, confidence,
    evidence_ids
  )
  select
    target_workspace_id, published_version.id, rule_key, scope, scope_id,
    rule_type, strength, status, source, description, applicability_json,
    confidence, evidence_ids
  from public.commercial_rules
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id
    and status <> 'rejected';

  update public.company_profile_drafts
  set state = 'approved', updated_at = now()
  where id = target_profile_draft_id;

  update public.company_profiles
  set current_version_id = published_version.id, updated_at = now()
  where workspace_id = target_workspace_id
    and id = draft_record.company_profile_id;

  insert into public.profile_change_events (
    workspace_id, profile_draft_id, event_type, actor_type, actor_user_id,
    affected_paths, details_json
  ) values (
    target_workspace_id, target_profile_draft_id, 'published', 'user',
    auth.uid(), array['profile'], jsonb_build_object(
      'profileVersionId', published_version.id,
      'version', published_version.version,
      'intelligenceVersion', 'v2'
    )
  );

  return published_version;
end;
$$;

revoke all on function public.publish_company_profile_v3_draft(
  uuid, uuid
) from public, anon;
grant execute on function public.publish_company_profile_v3_draft(
  uuid, uuid
) to authenticated;
