create or replace function public.legacy_retirement_readiness()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with audit as (
    select
      (select count(*) from public.offers) as legacy_offer_count,
      (select count(*) from public.campaigns where company_profile_version_id is null) as campaigns_missing_profile_version,
      (select count(*) from public.campaigns c where not exists (
        select 1 from public.campaign_profile_snapshots s where s.campaign_id = c.id
      )) as campaigns_missing_profile_snapshot,
      (select count(*) from public.campaigns where current_strategy_version_id is null) as campaigns_missing_strategy_version,
      (select count(*) from public.research_runs where strategy_version_id is null and campaign_id <> 'manual-lead-research') as research_runs_missing_strategy_version,
      (select count(*) from public.outreach_drafts where generated_at is not null and (
        company_profile_version_id is null or strategy_version_id is null or generation_task_id is null
      )) as generated_drafts_missing_provenance,
      (select count(*) from public.campaigns c
       join public.campaign_strategy_versions s on s.id = c.current_strategy_version_id
       where c.strategy_terms is distinct from s.search_terms
          or c.strategy_localized_terms is distinct from s.localized_terms
          or c.strategy_sources is distinct from s.source_categories
          or c.strategy_criteria is distinct from s.qualification_criteria
          or c.strategy_exclusions is distinct from s.exclusions
          or c.strategy_limitations is distinct from s.limitations
      ) as duplicated_strategy_mismatch_count
  )
  select jsonb_build_object(
    'ready', campaigns_missing_profile_version = 0
      and campaigns_missing_profile_snapshot = 0
      and campaigns_missing_strategy_version = 0
      and research_runs_missing_strategy_version = 0
      and generated_drafts_missing_provenance = 0
      and duplicated_strategy_mismatch_count = 0,
    'legacyOfferCount', legacy_offer_count,
    'campaignsMissingProfileVersion', campaigns_missing_profile_version,
    'campaignsMissingProfileSnapshot', campaigns_missing_profile_snapshot,
    'campaignsMissingStrategyVersion', campaigns_missing_strategy_version,
    'researchRunsMissingStrategyVersion', research_runs_missing_strategy_version,
    'generatedDraftsMissingProvenance', generated_drafts_missing_provenance,
    'duplicatedStrategyMismatchCount', duplicated_strategy_mismatch_count
  ) from audit;
$$;

revoke all on function public.legacy_retirement_readiness() from public;
revoke all on function public.legacy_retirement_readiness() from anon;
revoke all on function public.legacy_retirement_readiness() from authenticated;
grant execute on function public.legacy_retirement_readiness() to service_role;
