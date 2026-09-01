import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260827000700_contact_enrichment_credit_boundary.sql",
  "utf8",
);

test("Contact Enrichment authorizes and settles independently", () => {
  assert.match(migration, /contact_enrichment_credit_authorizations/);
  assert.match(migration, /authorize_contact_enrichment_credits/);
  assert.match(migration, /settle_contact_enrichment_credits/);
  assert.match(migration, /release_contact_enrichment_credits/);
  assert.match(migration, /available_credits = available_credits - target_max_credits/);
  assert.match(migration, /available_credits = available_credits \+ refund/);
  assert.doesNotMatch(migration, /research_credits_consumed\s*=/);
});

test("Contact Enrichment mutations remain service-role only", () => {
  assert.match(migration, /Service role required/);
  assert.match(migration, /to service_role/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
});
