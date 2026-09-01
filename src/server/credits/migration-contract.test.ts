import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260827000100_research_credit_accounting.sql",
  "utf8",
);

test("research credit reservations serialize campaign and workspace spending", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /research_credit_cap/);
  assert.match(migration, /available_credits = available_credits - target_estimated_credits/);
});

test("usage keeps actual cost separate from billable cost and product credits", () => {
  assert.match(migration, /actual_cost_usd/);
  assert.match(migration, /billable_cost_usd/);
  assert.match(migration, /opptium_credits/);
  assert.match(migration, /unique index usage_ledger_provider_request_actual_idx/);
});

test("unused authorization is not transferred or deducted", () => {
  assert.doesNotMatch(migration, /research_credit_cap\s*=\s*available_credits/i);
  assert.match(migration, /reserved_credits - target_opptium_credits/);
});
