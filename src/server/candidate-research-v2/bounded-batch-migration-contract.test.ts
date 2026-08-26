import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = new URL(
  "../../../supabase/migrations/20260813000300_bounded_candidate_research_batches_v2.sql",
  import.meta.url,
);

test("Candidate Research accepts only a nonempty bounded subset of a resolved pool", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /jsonb_array_length\(target_plans\) > expected_candidate_count/);
  assert.match(sql, /expected_candidate_count > 0 and jsonb_array_length\(target_plans\) = 0/);
  assert.match(sql, /<> jsonb_array_length\(target_plans\)/);
  assert.match(sql, /regprocedure/);
});
