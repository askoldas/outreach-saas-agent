import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260813000500_bind_research_artifacts_to_active_cycle_v2.sql",
  "utf8",
);

test("repeatable artifact RPCs bind their reads and writes to a research cycle", () => {
  assert.match(migration, /load_campaign_candidate_research_inputs_v2/);
  assert.match(migration, /prior_cycle\.cycle_number </);
  assert.match(migration, /initialize_candidate_research_batch_v2/);
  assert.match(migration, /initialize_candidate_qualification_batch_v2/);
  assert.match(migration, /load_campaign_ranking_inputs_v2/);
  assert.match(migration, /persist_campaign_ranking_v2/);
  assert.match(migration, /research_cycle_id = research_cycle\.id/);
  assert.match(migration, /Ranking Qualification cycle mismatch/);
});

test("migration refuses to silently patch an unexpected prior RPC contract", () => {
  assert.match(migration, /did not match its expected contract/g);
  assert.match(migration, /revised_definition = function_definition/g);
});
