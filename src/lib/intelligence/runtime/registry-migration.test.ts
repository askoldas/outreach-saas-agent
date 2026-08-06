import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000200_intelligence_contract_and_scoring_registry.sql",
  "utf8",
);

test("WP-02 creates the required immutable registries", () => {
  for (const table of [
    "intelligence_contracts",
    "prompt_versions",
    "workflow_versions",
    "scoring_versions",
    "provider_adapters",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`create trigger ${table}_immutable`));
  }
  assert.match(migration, /prevent_intelligence_registry_mutation/);
  assert.match(migration, /revoke insert, update, delete/);
});

test("WP-02 registers V1 as active and V2 as draft", () => {
  assert.match(migration, /\('campaign', 'v1', 'active'/);
  assert.match(migration, /\('campaign', 'v2', 'draft'/);
});
