create unique index if not exists campaign_memories_run_origin_unique
  on public.campaign_memories (campaign_run_id, category, origin);
