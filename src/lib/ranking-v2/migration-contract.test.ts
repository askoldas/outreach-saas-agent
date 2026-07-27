import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260728001500_comparative_ranking_v2.sql"),
  "utf8",
);

test("WP-17 persists comparative audit and immutable rank snapshots", () => {
  for (const table of [
    "comparative_batches",
    "comparative_batch_members",
    "comparative_anomalies",
    "candidate_rank_snapshots",
    "candidate_rank_entries",
    "candidate_explanations",
    "candidate_evaluation_events",
  ])
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  assert.match(migration, /included_evaluation_ids_json/);
  assert.match(migration, /ordering_trace_json/);
  assert.match(migration, /Comparative ranking workspace mismatch/);
});
