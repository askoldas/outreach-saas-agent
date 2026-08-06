-- Allow workspace admins to persist bounded Campaign Strategy model-call audits
-- without granting direct writes to the operational ai_requests table.

create or replace function public.record_campaign_strategy_ai_requests_v2(
  target_workspace_id uuid,
  target_strategy_draft_id uuid,
  target_requests jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  request_item jsonb;
  inserted_count integer := 0;
begin
  if not public.is_workspace_admin(target_workspace_id) then
    raise exception 'Workspace admin access required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.campaign_strategy_drafts draft
    where draft.id = target_strategy_draft_id
      and draft.workspace_id = target_workspace_id
  ) then
    raise exception 'Campaign Strategy draft not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(target_requests) <> 'array'
    or jsonb_array_length(target_requests) < 1
    or jsonb_array_length(target_requests) > 2
  then
    raise exception 'Campaign Strategy audit requires one or two model requests';
  end if;

  for request_item in select value from jsonb_array_elements(target_requests)
  loop
    if coalesce(request_item->>'role', '') not in (
      'campaign.market_context',
      'campaign.strategy_compiler'
    ) then
      raise exception 'Unsupported Campaign Strategy audit role';
    end if;

    if not exists (
      select 1
      from public.ai_requests request
      where request.workspace_id = target_workspace_id
        and request.role = request_item->>'role'
        and request.request_hash = request_item->>'requestHash'
        and request.status = 'completed'
        and request.metadata->>'strategyDraftId' = target_strategy_draft_id::text
        and request.metadata->>'outputHash' = request_item->>'outputHash'
    ) then
      insert into public.ai_requests (
        workspace_id, role, provider, selected_model, fallback_model,
        fallback_used, prompt_version, schema_version, request_hash, status,
        input_units, output_units, actual_cost, currency, metadata, completed_at
      ) values (
        target_workspace_id,
        request_item->>'role',
        'openrouter',
        request_item->>'selectedModel',
        nullif(request_item->>'fallbackModel', ''),
        coalesce((request_item->>'fallbackUsed')::boolean, false),
        request_item->>'promptVersion',
        nullif(request_item->>'schemaVersion', ''),
        request_item->>'requestHash',
        'completed',
        nullif(request_item->>'inputUnits', '')::bigint,
        nullif(request_item->>'outputUnits', '')::bigint,
        coalesce(nullif(request_item->>'actualCost', '')::numeric, 0),
        coalesce(nullif(request_item->>'currency', ''), 'USD'),
        jsonb_build_object(
          'actualModel', request_item->'actualModel',
          'latencyMs', request_item->'latencyMs',
          'outputHash', request_item->>'outputHash',
          'providerRequestId', request_item->'providerRequestId',
          'strategyDraftId', target_strategy_draft_id
        ),
        now()
      );
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return inserted_count;
end;
$$;

revoke all on function public.record_campaign_strategy_ai_requests_v2(
  uuid, uuid, jsonb
) from public, anon;
grant execute on function public.record_campaign_strategy_ai_requests_v2(
  uuid, uuid, jsonb
) to authenticated;
