-- Keep provider-response persistence below the API statement timeout by making each
-- branch of its duplicate-source identity lookup indexable.

create index if not exists provider_source_records_provider_record_lookup_v2_idx
on public.provider_source_records (
  workspace_id, campaign_id, provider_key, provider_record_id, created_at, id
)
where provider_record_id is not null;

create index if not exists provider_source_records_source_url_lookup_v2_idx
on public.provider_source_records (
  workspace_id, campaign_id, provider_key, source_url, created_at, id
)
where source_url is not null;

create index if not exists provider_source_records_payload_hash_lookup_v2_idx
on public.provider_source_records (
  workspace_id, campaign_id, provider_key, raw_payload_hash, created_at, id
);
