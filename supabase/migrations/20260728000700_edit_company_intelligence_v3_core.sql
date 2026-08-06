create or replace function public.update_company_profile_v3_core(
  target_workspace_id uuid,
  target_profile_draft_id uuid,
  target_public_name text,
  target_canonical_domain text,
  target_commercial_summary text,
  target_primary_role text,
  target_revenue_model text,
  target_transaction_model text,
  target_customer_usage_mode text
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  draft_state text;
  normalized_domain text;
  updated_snapshot jsonb;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Forbidden';
  end if;
  select state into draft_state
  from public.company_profile_drafts
  where workspace_id = target_workspace_id
    and id = target_profile_draft_id
  for update;
  if draft_state is null then
    raise exception 'Company Intelligence draft was not found.';
  end if;
  if draft_state not in ('needs_input', 'ready_for_review') then
    raise exception 'Company Intelligence draft is not reviewable.';
  end if;
  if length(trim(target_public_name)) = 0 then
    raise exception 'Public company name is required.';
  end if;
  normalized_domain := lower(trim(target_canonical_domain));
  normalized_domain := regexp_replace(normalized_domain, '^https?://', '');
  normalized_domain := split_part(normalized_domain, '/', 1);
  if normalized_domain !~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' then
    raise exception 'A valid canonical domain is required.';
  end if;
  if length(trim(target_commercial_summary)) = 0 then
    raise exception 'Commercial summary is required.';
  end if;

  select compiled_snapshot_json into updated_snapshot
  from public.company_profile_drafts
  where id = target_profile_draft_id;
  updated_snapshot := jsonb_set(
    updated_snapshot, '{identity,publicName}', to_jsonb(trim(target_public_name)), true
  );
  updated_snapshot := jsonb_set(
    updated_snapshot, '{identity,canonicalDomain}', to_jsonb(normalized_domain), true
  );
  updated_snapshot := jsonb_set(
    updated_snapshot,
    '{commercialSynthesis,conciseCommercialSummary}',
    to_jsonb(trim(target_commercial_summary)),
    true
  );

  update public.company_business_models
  set primary_role = nullif(trim(target_primary_role), ''),
      revenue_model = nullif(trim(target_revenue_model), ''),
      transaction_model = nullif(trim(target_transaction_model), ''),
      customer_usage_mode = nullif(trim(target_customer_usage_mode), ''),
      structured_details_json = jsonb_set(
        structured_details_json,
        '{conciseCommercialSummary}',
        to_jsonb(trim(target_commercial_summary)),
        true
      )
  where workspace_id = target_workspace_id
    and profile_draft_id = target_profile_draft_id;
  if not found then
    raise exception 'Company Intelligence business model is missing.';
  end if;

  update public.company_profile_drafts
  set compiled_snapshot_json = updated_snapshot,
      compiled_snapshot_hash = null,
      updated_at = now()
  where id = target_profile_draft_id;

  insert into public.profile_change_events (
    workspace_id, profile_draft_id, event_type, actor_type, actor_user_id,
    affected_paths, details_json
  ) values (
    target_workspace_id,
    target_profile_draft_id,
    'core_fields_updated',
    'user',
    auth.uid(),
    array[
      'identity.publicName',
      'identity.canonicalDomain',
      'businessModel.summary',
      'businessModel.primaryRole',
      'businessModel.revenueModel',
      'businessModel.transactionModel',
      'businessModel.customerUsageMode'
    ],
    jsonb_build_object('canonicalDomain', normalized_domain)
  );
end;
$$;

revoke all on function public.update_company_profile_v3_core(
  uuid, uuid, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.update_company_profile_v3_core(
  uuid, uuid, text, text, text, text, text, text, text
) to authenticated;
