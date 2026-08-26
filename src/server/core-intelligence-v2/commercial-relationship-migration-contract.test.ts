import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260824000700_commercial_relationship_assessments_v2.sql",
  "utf8",
);

test("Commercial Relationship assessments are immutable and workspace guarded", () => {
  assert.match(
    migration,
    /create table public\.commercial_relationship_assessment_versions_v2/i,
  );
  assert.match(migration, /company_intelligence_version_id uuid not null/i);
  assert.match(migration, /campaign_target_model_version_id uuid not null/i);
  assert.match(migration, /matched_archetype_ids jsonb not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /is_workspace_member\(workspace_id\)/i);
  assert.match(migration, /commercial_relationship_assessments_v2_immutable/i);
  assert.match(migration, /reject_core_intelligence_artifact_mutation_v2/i);
});
