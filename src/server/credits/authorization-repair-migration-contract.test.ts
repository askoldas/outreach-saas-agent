import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902000200_restore_additional_research_authorization.sql",
  "utf8",
);

test("repair restores cumulative authorization without deducting workspace credits", () => {
  assert.match(migration, /research_credit_cap = research_credit_cap \+ target_additional_credits/);
  assert.doesNotMatch(migration, /available_credits = available_credits -/);
  assert.match(migration, /research_pause_reason = null/);
});

test("authorization repair is serialized, scoped, and reloads PostgREST", () => {
  assert.match(migration, /pg_advisory_xact_lock/);
  assert.match(migration, /workspace_id = target_workspace_id/);
  assert.match(migration, /to authenticated, service_role/);
  assert.match(migration, /notify pgrst, 'reload schema'/);
});
