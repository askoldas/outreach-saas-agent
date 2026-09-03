-- Reconcile the legacy qualification-stage counter to canonical delivered companies
-- inside the same transaction that performs outcome settlement.
create or replace function public.finalize_company_research_outcome_v2(
  target_workspace_id uuid,
  target_campaign_run_id uuid,
  target_completion_reason text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare delivered integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  perform pg_advisory_xact_lock(
    hashtextextended('research-outcome:' || target_campaign_run_id::text, 0)
  );
  if not exists (
    select 1 from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id
  ) then raise exception 'Campaign Run not found.'; end if;

  select count(distinct candidate.display_organization_id)::integer into delivered
  from public.candidate_qualification_batches_v2 batch
  join public.candidate_qualification_batch_members_v2 member
    on member.candidate_qualification_batch_id = batch.id
  join public.campaign_candidates candidate on candidate.id = member.campaign_candidate_id
  where batch.workspace_id = target_workspace_id
    and batch.campaign_run_id = target_campaign_run_id
    and member.status = 'completed'
    and member.output_reference_json->>'lane' in ('recommended', 'conditional');

  delivered := coalesce(delivered, 0);
  update public.campaign_runs
  set delivered_company_count = delivered,
      companies_qualified = delivered
  where id = target_campaign_run_id and workspace_id = target_workspace_id;

  return public.finalize_company_research_outcome(
    target_workspace_id,
    target_campaign_run_id,
    target_completion_reason
  );
end; $$;

revoke all on function public.finalize_company_research_outcome_v2(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.finalize_company_research_outcome_v2(uuid, uuid, text)
  to service_role;
notify pgrst, 'reload schema';
