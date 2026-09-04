import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("supabase/migrations/20260904001100_company_profile_target_roles_and_relationships.sql", "utf8");
const service = readFileSync("src/server/company-profile-v3/stage-service.ts", "utf8");

test("profile compilation persists canonical target roles and evidence-backed relationships", () => {
  assert.match(migration, /create table public\.company_target_roles_v2/);
  assert.match(migration, /offering_keys text\[\]/);
  assert.match(migration, /archetype_keys text\[\]/);
  assert.match(migration, /evidence_ids uuid\[\]/);
  assert.match(migration, /organization_relationship_memories_v2/);
  assert.match(service, /persist_company_profile_commercial_extensions_v2/);
});

test("AI profile refresh deletes only its own draft relationships", () => {
  assert.match(migration, /profile_draft_id=target_profile_draft_id/);
  assert.match(migration, /source in \('company_profile','seller_site','other'\)/);
  assert.doesNotMatch(migration, /source in \([^)]*user_confirmed/);
});
