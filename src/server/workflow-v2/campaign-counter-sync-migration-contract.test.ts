import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000700_sync_v2_campaign_run_counters.sql",
  ),
  "utf8",
);

test("V2 task settlement synchronizes the campaign progress read model", () => {
  assert.match(
    migration,
    /create or replace function public\.sync_v2_campaign_run_counters\(\)/,
  );
  assert.match(
    migration,
    /after insert or update of status, output_reference_json[\s\S]+?on public\.intelligence_task_runs/,
  );
  for (const field of [
    "candidates_discovered",
    "candidates_unique",
    "candidates_classified",
    "current_iteration",
    "companies_discovered",
    "companies_evaluated",
    "companies_qualified",
  ]) {
    assert.match(migration, new RegExp(`${field} = greatest\\(`));
  }
});

test("V2 progress backfill derives counters from durable stage outputs", () => {
  assert.match(migration, /with stage_progress as \(/);
  assert.match(migration, /task\.task_type = 'discover'/);
  assert.match(migration, /task\.task_type = 'resolve_entities'/);
  assert.match(migration, /task\.task_type = 'qualify_candidates'/);
  assert.match(migration, /campaign_run\.workflow_version = 'v2'/);
});

test("V2 campaign counter synchronization is not directly executable", () => {
  assert.match(
    migration,
    /revoke all on function public\.sync_v2_campaign_run_counters\(\)\s+from public, anon, authenticated;/,
  );
});
