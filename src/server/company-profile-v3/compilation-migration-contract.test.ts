import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000500_compile_company_intelligence_v3_draft.sql",
  "utf8",
);

test("V3 normalized compilation is one service-role-only database operation", () => {
  assert.match(migration, /compile_company_profile_v3_draft/);
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(migration, /for update/);
  assert.match(migration, /revoke all[\s\S]+authenticated/);
  assert.match(migration, /grant execute[\s\S]+service_role/);
});

test("V3 recompilation replaces mutable children but preserves stable offerings", () => {
  assert.match(migration, /delete from public\.company_business_models/);
  assert.match(migration, /delete from public\.company_offering_versions/);
  assert.match(migration, /delete from public\.commercial_rules/);
  assert.doesNotMatch(migration, /delete from public\.company_offerings/);
  assert.match(migration, /on conflict \(company_profile_id, stable_key\)/);
});
