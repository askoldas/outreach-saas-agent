import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260728001700_repair_semantic_discovery_coverage.sql",
  ),
  "utf8",
);

test("semantic discovery repair avoids every legacy discovery table collision", () => {
  assert.match(migration, /create table public\.discovery_plans_v2/);
  assert.doesNotMatch(migration, /create table public\.discovery_plans\s*\(/);
  assert.match(
    migration,
    /discovery_plan_id uuid not null references public\.discovery_plans_v2/,
  );
});

test("semantic discovery repair restores every required runtime relation", () => {
  for (const table of [
    "discovery_plans_v2",
    "discovery_segments_v2",
    "discovery_source_plans_v2",
    "discovery_runs_v2",
    "discovery_segment_runs_v2",
    "discovery_queries_v2",
    "discovery_coverage_snapshots_v2",
    "discovery_gaps_v2",
    "discovery_gap_actions_v2",
    "discovery_usage_events_v2",
  ])
    assert.match(
      migration,
      new RegExp(`create table public\\.${table}\\s*\\(`),
    );
  assert.doesNotMatch(
    migration,
    /create table public\.discovery_queries\s*\(/,
  );
  assert.match(migration, /create_discovery_plan_v2/);
  assert.match(migration, /persist_discovery_coverage_decision_v2/);
});
