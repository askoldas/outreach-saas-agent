import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20260903000100_unlimited_research_accounts.sql",
  "utf8",
);

test("unlimited research accounts bypass campaign credit ceilings", () => {
  assert.match(migration, /unlimited_research boolean not null default false/);
  assert.match(migration, /when account\.unlimited_research then 1000000/);
  assert.match(migration, /quoted_research_credits = quoted_credits/);
  assert.match(migration, /research_credit_cap = effective_cap/);
});

test("unlimited research remains an explicit service-controlled exception", () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /to service_role/);
});
