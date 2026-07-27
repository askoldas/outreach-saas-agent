import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728001000_discovery_provider_contracts.sql",
  "utf8",
);

test("WP-11 persists capability snapshots, executions, raw records, and normalization", () => {
  for (const table of [
    "discovery_provider_capability_snapshots",
    "discovery_provider_executions",
    "provider_source_records",
    "normalized_provider_candidates",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /capability_snapshot_id uuid not null/i);
  assert.match(migration, /raw_payload_json jsonb not null/i);
  assert.match(migration, /preliminary_quality_json jsonb not null/i);
});

test("provider persistence is immutable, tenant guarded, and idempotent", () => {
  assert.match(migration, /Cross-workspace Discovery provider association/i);
  assert.match(migration, /provider_source_records_immutable/i);
  assert.match(migration, /normalized_provider_candidates_immutable/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /unique \(provider_execution_id, source_record_key\)/i);
  assert.match(migration, /provider_key, adapter_version, request_hash[\s\S]*\)/i);
});

test("one RPC atomically retains raw records before normalized candidates", () => {
  assert.match(
    migration,
    /create or replace function public\.persist_discovery_provider_response/i,
  );
  const rawInsert = migration.indexOf("insert into public.provider_source_records");
  const normalizedInsert = migration.indexOf(
    "insert into public.normalized_provider_candidates",
  );
  assert.ok(rawInsert > 0);
  assert.ok(normalizedInsert > rawInsert);
  assert.match(migration, /Normalized candidate references an unknown source record/i);
  assert.match(migration, /duplicate_of_source_record_id/i);
  assert.match(migration, /then 'suppressed'/i);
  assert.match(migration, /to authenticated, service_role/i);
});
