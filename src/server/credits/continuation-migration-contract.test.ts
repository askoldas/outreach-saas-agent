import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const release = readFileSync("supabase/migrations/20260827000200_release_failed_research_reservations.sql", "utf8");
const overview = readFileSync("supabase/migrations/20260827000300_evolving_market_overviews.sql", "utf8");
const continuation = readFileSync("supabase/migrations/20260827000400_authorize_additional_research_credits.sql", "utf8");
const pausePersistence = readFileSync("supabase/migrations/20260827000500_persist_budget_pause_decisions.sql", "utf8");
const safeSettlement = readFileSync("supabase/migrations/20260827000600_settle_research_overages_safely.sql", "utf8");

test("failed provider work releases its reservation once", () => {
  assert.match(release, /pg_advisory_xact_lock/);
  assert.match(release, /status = 'released'/);
  assert.match(release, /available_credits = available_credits \+ reservation\.reserved_credits/);
  assert.match(release, /on conflict \(workspace_id, entry_type, idempotency_key\) do nothing/);
});

test("Market Overview versions are campaign-cycle scoped and immutable by identity", () => {
  assert.match(overview, /research_market_overview_versions/);
  assert.match(overview, /unique \(campaign_run_id, cycle_number\)/);
  assert.match(overview, /Market Overview retry changed frozen cycle output/);
  assert.match(overview, /is_workspace_member\(workspace_id\)/);
});

test("additional credits increase authorization on the same serialized Campaign Run", () => {
  assert.match(continuation, /pg_advisory_xact_lock/);
  assert.match(continuation, /research_credit_cap = research_credit_cap \+ target_additional_credits/);
  assert.doesNotMatch(continuation, /insert into public\.campaign_runs/);
});

test("reservation denials persist the actionable pause reason", () => {
  assert.match(pausePersistence, /research_pause_reason = 'campaign_budget'/);
  assert.match(pausePersistence, /research_pause_reason = 'workspace_balance'/);
  assert.match(pausePersistence, /'granted', false/);
  assert.doesNotMatch(pausePersistence, /raise exception 'Campaign research credit authorization exhausted\.'/);
});

test("provider overages settle actual usage without exceeding authorized credits", () => {
  assert.match(safeSettlement, /chargeable_credits := least/);
  assert.match(safeSettlement, /target_actual_cost_usd/);
  assert.match(safeSettlement, /unchargedOverageCredits/);
  assert.match(safeSettlement, /research_pause_reason = pause_reason/);
  assert.doesNotMatch(safeSettlement, /Actual usage exceeds/);
});
