-- Count delivered outcomes at the canonical organization boundary without API row limits.
create or replace function public.get_company_research_outcome_progress(
  target_workspace_id uuid,
  target_campaign_run_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare target_run public.campaign_runs;
declare delivered integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into target_run from public.campaign_runs
    where id = target_campaign_run_id and workspace_id = target_workspace_id for update;
  if target_run.id is null then raise exception 'Campaign Run not found.'; end if;
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
  update public.campaign_runs set delivered_company_count = delivered where id = target_run.id;
  return jsonb_build_object('schemaVersion', 1,
    'authorized', target_run.outcome_quote_json is not null,
    'requestedCompanyCount', target_run.requested_company_count,
    'deliveredCompanyCount', delivered,
    'targetReached', target_run.outcome_quote_json is not null
      and delivered >= target_run.requested_company_count,
    'settled', target_run.outcome_settled_at is not null);
end; $$;
revoke all on function public.get_company_research_outcome_progress(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_company_research_outcome_progress(uuid, uuid)
  to service_role;
notify pgrst, 'reload schema';
