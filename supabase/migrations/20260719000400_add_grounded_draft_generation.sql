alter table public.outreach_drafts
  add column company_profile_version_id uuid references public.company_profile_versions(id) on delete restrict,
  add column strategy_version_id uuid references public.campaign_strategy_versions(id) on delete restrict,
  add column generation_task_id uuid references public.research_tasks(id) on delete set null,
  add column prompt_version text,
  add column generated_at timestamptz;

create unique index outreach_drafts_campaign_lead_variant_idx
on public.outreach_drafts(workspace_id, campaign_external_id, lead_external_id, variant);

create index outreach_drafts_generation_task_idx
on public.outreach_drafts(generation_task_id);
