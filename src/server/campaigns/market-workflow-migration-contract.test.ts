import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000700_campaign_market_discovery_stages.sql",
  import.meta.url,
);

test("campaign workflow migration persists every staged artifact with RLS", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  for (const table of [
    "campaign_briefs",
    "market_analyses",
    "discovery_plans",
    "discovery_paths",
    "discovery_iterations",
    "discovery_queries",
    "discovery_candidates",
    "candidate_classifications",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/);
  assert.match(migration, /public\.is_workspace_admin\(workspace_id\)/);
  assert.match(migration, /iteration_number between 1 and 5/i);
  assert.match(migration, /result_limit between 1 and 50/i);
});
