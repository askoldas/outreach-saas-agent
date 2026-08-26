import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migrationUrl = new URL("../../../supabase/migrations/20260813000200_adaptive_research_cycles_v2.sql", import.meta.url);

test("adaptive research cycles persist immutable budget, usage, and decisions", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /create table public\.campaign_research_cycles_v2/);
  assert.match(sql, /create table public\.campaign_research_cycle_decisions_v2/);
  assert.match(sql, /unique \(campaign_run_id, cycle_number\)/);
  assert.match(sql, /ensure_campaign_research_cycle_v2/);
  assert.match(sql, /finalize_campaign_research_cycle_v2/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /is_workspace_member\(workspace_id\)/);
});
