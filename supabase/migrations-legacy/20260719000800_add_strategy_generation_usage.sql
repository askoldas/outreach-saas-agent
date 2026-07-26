alter table public.usage_events drop constraint usage_events_operation_check;
alter table public.usage_events add constraint usage_events_operation_check check (
  operation in (
    'company_research','source_processing','qualification','contact_enrichment',
    'verification','draft_generation','strategy_generation','export'
  )
);
