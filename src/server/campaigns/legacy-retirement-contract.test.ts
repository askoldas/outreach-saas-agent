import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260719000500_add_legacy_retirement_readiness_audit.sql",
    import.meta.url,
  ),
  "utf8",
);

test("legacy retirement audit checks every frozen replacement boundary", () => {
  assert.match(migration, /campaigns_missing_profile_version/i);
  assert.match(migration, /campaigns_missing_profile_snapshot/i);
  assert.match(migration, /campaigns_missing_strategy_version/i);
  assert.match(migration, /research_runs_missing_strategy_version/i);
  assert.match(migration, /generated_drafts_missing_provenance/i);
  assert.match(migration, /duplicated_strategy_mismatch_count/i);
});

test("legacy retirement audit is restricted to service role", () => {
  assert.match(migration, /revoke all.*authenticated/is);
  assert.match(migration, /grant execute.*service_role/is);
});
