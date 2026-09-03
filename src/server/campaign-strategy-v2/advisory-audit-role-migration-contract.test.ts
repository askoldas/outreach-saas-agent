import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260902000100_allow_campaign_strategy_advisory_audit_role.sql",
  "utf8",
);

test("Campaign Strategy advisory output retains its truthful audit role", () => {
  assert.match(migration, /'campaign\.strategy_advisory_delta'/);
  assert.match(migration, /request\.role = request_item->>'role'/);
  assert.match(migration, /strategyDraftId/);
});

test("Trigger workers and workspace admins can persist bounded audits", () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /jsonb_array_length\(target_requests\) > 2/);
  assert.match(migration, /to authenticated, service_role/);
});
