import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function source(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
}

const migration = source(
  "../../../supabase/migrations/20260727000500_restrict_operational_table_writes.sql",
);

test("authenticated admin mutation policies are removed from operational tables", () => {
  for (const table of [
    "activity_events",
    "campaign_runs",
    "campaign_run_events",
    "operation_idempotency_keys",
    "provider_executions",
    "ai_requests",
    "usage_ledger",
    "budget_reservations",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /drop policy if exists/i);
  assert.doesNotMatch(migration, /create policy[\s\S]*for (all|insert|update|delete)/i);
});

test("server operational writers use the service-role client", () => {
  for (const file of [
    "../research/repository.ts",
    "../trigger/dispatch.ts",
    "../outreach/repository.ts",
    "../activity/repository.ts",
  ]) {
    assert.match(source(file), /createServiceRoleClient/);
  }
});
