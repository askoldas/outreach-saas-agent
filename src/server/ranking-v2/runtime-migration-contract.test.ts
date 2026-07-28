import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728002700_retry_safe_comparative_ranking_stage.sql",
);
const stage = source("src/server/ranking-v2/stage-service.ts");
const workflow = source("src/server/workflow-v2/stage-service.ts");

test("Ranking freezes the exact settled Qualification batch", () => {
  assert.match(migration, /load_campaign_ranking_inputs_v2/);
  assert.match(migration, /candidate_qualification_batches_v2/);
  assert.match(migration, /candidate_qualification_batch_members_v2/);
  assert.match(migration, /member\.status = 'completed'/);
  assert.match(migration, /input_snapshot_json/);
  assert.match(migration, /compiled_snapshot_json/);
});

test("Ranking persists deterministic batches, anomalies, and immutable entries atomically", () => {
  assert.match(migration, /persist_campaign_ranking_v2/);
  assert.match(migration, /insert into public\.comparative_batches/);
  assert.match(migration, /insert into public\.comparative_anomalies/);
  assert.match(migration, /insert into public\.candidate_rank_snapshots/);
  assert.match(migration, /insert into public\.candidate_rank_entries/);
  assert.match(migration, /Ranking retry input does not match the frozen snapshot/);
});

test("Ranking remains lane-first, deterministic, and model-free", () => {
  assert.match(stage, /createStableRankEntries/);
  assert.match(stage, /detectConsistencyAnomalies/);
  assert.match(stage, /lane-first-stable-v2\.1/);
  assert.match(stage, /stableTieBreaker/);
  assert.match(stage, /usageEventIds: \[\]/);
  assert.doesNotMatch(stage, /generateTextResult|OPENROUTER|Promise\.all/);
});

test("Ranking canonical mutations are service-role only", () => {
  assert.match(migration, /result_write_mode = 'canonical'/);
  assert.match(migration, /settings\.shadow_mode = false/);
  assert.match(
    migration,
    /revoke all on function public\.persist_campaign_ranking_v2[\s\S]*from public, anon, authenticated/,
  );
  assert.match(
    migration,
    /grant execute on function public\.persist_campaign_ranking_v2[\s\S]*to service_role/,
  );
});

test("rank_candidates is connected to the durable stage boundary", () => {
  assert.match(workflow, /input\.stage === "rank_candidates"/);
  assert.match(workflow, /executeRankingStage/);
});
