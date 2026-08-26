import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  "supabase/migrations/20260813000600_reserve_campaign_research_continuation_v2.sql",
  "utf8",
);

test("continuation reservation is tenant guarded, serialized, and decision bound", () => {
  assert.match(sql, /is_workspace_admin\(target_workspace_id\)/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /order by cycle\.cycle_number desc/);
  assert.match(sql, /previous_cycle\.status <> 'complete'/);
  assert.match(sql, /additionalOpportunityRemains/);
  assert.match(sql, /continuation_of_cycle_id/);
  assert.match(sql, /previous_cycle\.status = 'running'/);
  assert.match(sql, /previous_cycle\.budget_json <> target_budget/);
});

test("continuation reservation remains service-only", () => {
  assert.match(sql, /revoke all on function[\s\S]*from public, anon, authenticated/);
  assert.match(sql, /grant execute on function[\s\S]*to service_role/);
});
