import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260802000100_commercial_candidate_preclassification.sql",
  "utf8",
);
const repository = readFileSync("src/server/discovery-v2/provider-repository.ts", "utf8");
const providerService = readFileSync(
  "src/server/discovery-v2/provider-service.ts",
  "utf8",
);

test("commercial preclassifications are immutable, tenant-scoped, and Strategy-bound", () => {
  assert.match(migration, /provider_candidate_preclassifications_v2/);
  assert.match(migration, /campaign_strategy_version_id uuid not null/);
  assert.match(migration, /provider_candidate_preclassifications_v2_immutable/);
  assert.match(migration, /is_workspace_member\(workspace_id\)/);
  assert.match(migration, /to service_role/);
});

test("provider persistence freezes every source disposition before replay", () => {
  assert.match(repository, /persist_provider_candidate_preclassifications_v2/);
  assert.match(migration, /Every provider source requires exactly one preclassification/);
  assert.match(providerService, /normalizationVersion: input\.normalizationVersion/);
});

test("preclassification hashing resolves Supabase pgcrypto", () => {
  assert.match(migration, /extensions\.digest\(classification::text, 'sha256'\)/);
  const repair = readFileSync(
    "supabase/migrations/20260803000300_fix_preclassification_digest_resolution.sql",
    "utf8",
  );
  assert.match(repair, /set search_path = public, extensions/);
});
