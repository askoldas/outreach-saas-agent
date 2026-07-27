import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728001200_organization_graph_entity_resolution.sql",
  ),
  "utf8",
);

test("organization graph migration preserves canonical source records and audit history", () => {
  for (const table of [
    "organization_relationships",
    "organization_buying_hypotheses",
    "entity_resolution_cases",
    "entity_match_assessments",
    "entity_resolution_decisions",
    "organization_source_links",
    "organization_merge_events",
    "organization_split_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /merged_into_company_id uuid/);
  assert.doesNotMatch(migration, /delete from public\.companies/i);
});

test("merge and split operations are guarded, auditable, and reversible", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /pre_merge_snapshot_json/);
  assert.match(migration, /create or replace function public\.merge_organizations_v2/);
  assert.match(
    migration,
    /create or replace function public\.split_organization_merge_v2/,
  );
  assert.match(migration, /merged_into_company_id = null/);
  assert.match(migration, /Cross-workspace organization merge/);
});
