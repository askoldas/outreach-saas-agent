import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260902000400_outcome_based_research_contract.sql",
  "utf8",
);

test("outcome authorization persists a versioned quote and requested quantity", () => {
  assert.match(migration, /requested_company_count integer not null/);
  assert.match(migration, /outcome_quote_json jsonb/);
  assert.match(migration, /quoted_research_credits numeric/);
  assert.match(migration, /authorize_company_research_outcome/);
  assert.match(migration, /pricingBasis/);
});

test("outcome settlement is serialized idempotent and service-role only", () => {
  assert.match(migration, /finalize_company_research_outcome/);
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /outcome_settled_at is not null/);
  assert.match(migration, /idempotent', true/);
  assert.match(migration, /Service role required/);
  assert.match(
    migration,
    /revoke all on function public\.finalize_company_research_outcome[\s\S]*authenticated/,
  );
});

test("partial settlement preserves provider costs and reconciles product credits", () => {
  assert.match(migration, /actual_work_bounded_by_outcome_value_v1/);
  assert.match(
    migration,
    /available_credits = available_credits \+ active_reserved \+ refund/,
  );
  assert.match(migration, /research_credits_consumed = final_charge/);
  assert.match(migration, /entry_type,[\s\S]*'adjustment'/);
  assert.doesNotMatch(migration, /delete from public\.usage_ledger/);
});

test("target revisions are tenant-owned and append-only", () => {
  assert.match(migration, /create table public\.campaign_run_target_revisions/);
  assert.match(migration, /requested_company_count > previous_requested_company_count/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});
