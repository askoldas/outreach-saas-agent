import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = new URL(
  "../../../supabase/migrations/20260813000400_cycle_aware_research_artifacts_v2.sql",
  import.meta.url,
);

test("repeatable research artifacts are cycle-addressed and cycle-1 backfilled", async () => {
  const sql = await readFile(migration, "utf8");
  for (const table of [
    "candidate_research_batches_v2",
    "candidate_qualification_batches_v2",
    "comparative_batches",
    "candidate_rank_snapshots",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table}[\\s\\S]*research_cycle_id`));
  }
  assert.match(sql, /cycle\.cycle_number = 1/g);
  assert.match(sql, /candidate_research_batches_v2_run_cycle_idx/);
  assert.match(sql, /candidate_qualification_batches_v2_run_cycle_idx/);
  assert.match(sql, /comparative_batches_v2_cycle_lane_batch_idx/);
  assert.match(sql, /candidate_rank_snapshots_v2_cycle_idx/);
  assert.match(sql, /Every existing V2 repeatable artifact requires a cycle-1 parent/);
});
