import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260813000100_discovery_source_expansion_v2.sql",
  "utf8",
);
const repository = readFileSync("src/server/discovery-v2/provider-repository.ts", "utf8");

test("source expansion persistence is tenant-scoped, retry-safe, and resumable", () => {
  assert.match(migration, /discovery_source_expansions_v2/);
  assert.match(migration, /discovery_source_organization_references_v2/);
  assert.match(migration, /next_offset/);
  assert.match(migration, /status in \('partial', 'completed', 'failed'\)/);
  assert.match(migration, /unique \(provider_source_record_id, extraction_version\)/);
  assert.match(migration, /reference_key/);
  assert.match(migration, /pg_get_constraintdef/);
  assert.doesNotMatch(
    migration,
    /drop constraint normalized_provider_candidates_provider_source_record_id_normalization_version_key/,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});

test("source references enter existing normalization and Entity Resolution", () => {
  assert.match(migration, /normalized_provider_candidates/);
  assert.match(migration, /discovery_source_reference_id/);
  assert.match(migration, /load_campaign_entity_resolution_inputs_v2/);
  assert.match(migration, /extractionMethod/);
  assert.match(repository, /persist_discovery_source_expansion_v2/);
});
