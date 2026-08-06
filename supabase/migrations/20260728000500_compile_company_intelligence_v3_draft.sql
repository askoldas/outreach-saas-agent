create or replace function public.compile_company_profile_v3_draft(
  target_workspace_id uuid,
  target_profile_draft_id uuid,
  target_compilation jsonb
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  draft_record public.company_profile_drafts;
  business_model_id uuid;
  offering_record jsonb;
  archetype_record jsonb;
  rule_record jsonb;
  question_record jsonb;
  offering_id uuid;
  offering_version_id uuid;
  rule_scope_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Forbidden';
  end if;
  if jsonb_typeof(target_compilation) <> 'object' then
    raise exception 'Compilation payload must be an object.';
  end if;

  select * into draft_record
  from public.company_profile_drafts
  where workspace_id = target_workspace_id
    and id = target_profile_draft_id
  for update;
  if draft_record.id is null then
    raise exception 'Company Intelligence draft was not found.';
  end if;

  delete from public.commercial_rules
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;
  delete from public.profile_clarification_questions
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;
  delete from public.company_offering_versions
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;
  delete from public.company_business_models
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;

  insert into public.company_business_models (
    workspace_id, profile_draft_id, primary_role, revenue_model,
    transaction_model, customer_usage_mode, sales_motion,
    structured_details_json, confidence
  ) values (
    target_workspace_id,
    target_profile_draft_id,
    nullif(target_compilation #>> '{businessModel,primaryRole}', ''),
    nullif(target_compilation #>> '{businessModel,revenueModel}', ''),
    nullif(target_compilation #>> '{businessModel,transactionModel}', ''),
    nullif(target_compilation #>> '{businessModel,customerUsageMode}', ''),
    nullif(target_compilation #>> '{businessModel,salesMotion}', ''),
    coalesce(target_compilation #> '{businessModel,details}', '{}'::jsonb),
    coalesce((target_compilation #>> '{businessModel,confidence}')::numeric, 0)
  )
  returning id into business_model_id;

  for offering_record in
    select value from jsonb_array_elements(
      coalesce(target_compilation->'offerings', '[]'::jsonb)
    )
  loop
    insert into public.company_offerings (
      workspace_id, company_profile_id, stable_key
    ) values (
      target_workspace_id,
      draft_record.company_profile_id,
      offering_record->>'stableKey'
    )
    on conflict (company_profile_id, stable_key) do update
    set archived_at = null
    returning id into offering_id;

    insert into public.company_offering_versions (
      workspace_id, company_offering_id, profile_draft_id, slug, name,
      status, offering_type, short_description, commercial_mechanics_json,
      buyer_logic_json, relationship_options_json, constraints_json,
      confidence, evidence_ids
    ) values (
      target_workspace_id,
      offering_id,
      target_profile_draft_id,
      offering_record->>'slug',
      offering_record->>'name',
      offering_record->>'status',
      offering_record->>'offeringType',
      offering_record->>'shortDescription',
      coalesce(offering_record->'commercialMechanics', '{}'::jsonb),
      coalesce(offering_record->'buyerLogic', '{}'::jsonb),
      coalesce(offering_record->'relationshipOptions', '[]'::jsonb),
      coalesce(offering_record->'constraints', '[]'::jsonb),
      coalesce((offering_record->>'confidence')::numeric, 0),
      coalesce(
        array(select jsonb_array_elements_text(offering_record->'evidenceIds')),
        '{}'::text[]
      )::uuid[]
    )
    returning id into offering_version_id;

    for archetype_record in
      select value from jsonb_array_elements(
        coalesce(offering_record->'archetypes', '[]'::jsonb)
      )
    loop
      insert into public.buyer_archetype_hypotheses (
        workspace_id, profile_draft_id, offering_version_id, archetype_key,
        name, relationship_type, priority, status, structured_details_json,
        confidence, evidence_ids
      ) values (
        target_workspace_id,
        target_profile_draft_id,
        offering_version_id,
        archetype_record->>'archetypeKey',
        archetype_record->>'name',
        archetype_record->>'relationshipType',
        archetype_record->>'priority',
        'proposed',
        coalesce(archetype_record->'details', '{}'::jsonb),
        coalesce((archetype_record->>'confidence')::numeric, 0),
        coalesce(
          array(select jsonb_array_elements_text(archetype_record->'evidenceIds')),
          '{}'::text[]
        )::uuid[]
      );
    end loop;
  end loop;

  insert into public.company_business_roles (
    workspace_id, business_model_id, role_type, priority, confidence, evidence_ids
  )
  select
    target_workspace_id,
    business_model_id,
    value->>'roleType',
    value->>'priority',
    coalesce((value->>'confidence')::numeric, 0),
    coalesce(
      array(select jsonb_array_elements_text(value->'evidenceIds')),
      '{}'::text[]
    )::uuid[]
  from jsonb_array_elements(
    coalesce(target_compilation #> '{businessModel,roles}', '[]'::jsonb)
  );

  for rule_record in
    select value from jsonb_array_elements(
      coalesce(target_compilation->'rules', '[]'::jsonb)
    )
  loop
    if rule_record->>'scope' = 'workspace' then
      rule_scope_id := target_workspace_id;
    else
      select id into rule_scope_id
      from public.company_offerings
      where workspace_id = target_workspace_id
        and company_profile_id = draft_record.company_profile_id
        and stable_key = rule_record->>'offeringKey';
    end if;
    if rule_scope_id is null then
      raise exception 'Rule % has an unknown offering.', rule_record->>'ruleKey';
    end if;
    insert into public.commercial_rules (
      workspace_id, profile_draft_id, rule_key, scope, scope_id, rule_type,
      strength, status, source, description, applicability_json, confidence,
      evidence_ids
    ) values (
      target_workspace_id,
      target_profile_draft_id,
      rule_record->>'ruleKey',
      rule_record->>'scope',
      rule_scope_id,
      rule_record->>'ruleType',
      rule_record->>'strength',
      'proposed',
      rule_record->>'source',
      rule_record->>'description',
      coalesce(rule_record->'applicability', '{}'::jsonb),
      coalesce((rule_record->>'confidence')::numeric, 0),
      coalesce(
        array(select jsonb_array_elements_text(rule_record->'evidenceIds')),
        '{}'::text[]
      )::uuid[]
    );
  end loop;

  for question_record in
    select value from jsonb_array_elements(
      coalesce(target_compilation->'questions', '[]'::jsonb)
    )
  loop
    insert into public.profile_clarification_questions (
      workspace_id, profile_draft_id, question_key, category, question,
      explanation, answer_type, options_json, impact, affected_paths, skip_allowed
    ) values (
      target_workspace_id,
      target_profile_draft_id,
      question_record->>'questionKey',
      question_record->>'category',
      question_record->>'question',
      question_record->>'explanation',
      question_record->>'answerType',
      coalesce(question_record->'options', '[]'::jsonb),
      question_record->>'impact',
      coalesce(
        array(select jsonb_array_elements_text(question_record->'affectedPaths')),
        '{}'::text[]
      ),
      coalesce((question_record->>'skipAllowed')::boolean, true)
    );
  end loop;

  update public.company_profile_drafts
  set compiled_snapshot_json = coalesce(
        target_compilation->'compiledSnapshot',
        compiled_snapshot_json
      ),
      compiled_snapshot_hash = target_compilation->>'compiledSnapshotHash',
      updated_at = now()
  where id = target_profile_draft_id;
end;
$$;

revoke all on function public.compile_company_profile_v3_draft(
  uuid, uuid, jsonb
) from public, anon, authenticated;
grant execute on function public.compile_company_profile_v3_draft(
  uuid, uuid, jsonb
) to service_role;
