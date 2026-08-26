import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000600_company_intelligence_artifacts_v2.sql",
  "utf8",
);

test("Company Intelligence artifacts are immutable, tenant-scoped, and source-bound", () => {
  assert.match(migration, /create table public\.company_intelligence_versions_v2/i);
  assert.match(migration, /source_candidate_intelligence_version_id uuid not null/i);
  assert.match(migration, /research_blueprint_version_ids jsonb not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /is_workspace_member\(workspace_id\)/i);
  assert.match(migration, /company_intelligence_versions_v2_immutable/i);
  assert.match(migration, /reject_core_intelligence_artifact_mutation_v2/i);
  assert.match(migration, /source mismatch/i);
});
