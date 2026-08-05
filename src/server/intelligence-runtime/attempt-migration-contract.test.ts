import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260803000400_intelligence_ai_attempt_ledger.sql",
  "utf8",
);
const repository = readFileSync(
  "src/server/intelligence-runtime/attempt-repository.ts",
  "utf8",
);

test("shared Intelligence attempts are tenant-scoped and append-only", () => {
  assert.match(migration, /create table public\.intelligence_ai_attempts/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
  assert.match(migration, /revoke insert, update, delete/);
  assert.match(migration, /grant select, insert.*service_role/s);
});

test("attempt recorder persists success and failure diagnostics with service role", () => {
  assert.match(repository, /createServiceRoleClient/);
  assert.match(repository, /validation_issue/);
  assert.match(repository, /error_code/);
  assert.match(repository, /model_route_version/);
});

test("optional attempt telemetry cannot fail the primary Intelligence task", () => {
  assert.match(repository, /strict\?: boolean/);
  assert.match(repository, /const \{ strict = false/);
  assert.match(repository, /if \(strict\) throw error/);
  assert.match(repository, /console\.error/);
});