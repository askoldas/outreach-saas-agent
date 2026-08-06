import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729000700_reviewed_profile_publish_gate.sql",
  "utf8",
);

test("V3 publish validates ownership, review state, and structural prerequisites", () => {
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/);
  assert.match(
    migration,
    /draft_record\.state not in \('ready_for_review', 'needs_input'\)/,
  );
  assert.doesNotMatch(migration, /profile\.consistency_audit/);
  assert.doesNotMatch(migration, /consistency_recommendation/);
  assert.doesNotMatch(migration, /impact = 'blocking'/);
  assert.match(migration, /status = 'active'/);
});

test("all profile clarifications are optional in storage and publication", () => {
  const optionalityMigration = readFileSync(
    "supabase/migrations/20260729000600_optional_profile_clarifications.sql",
    "utf8",
  );
  assert.match(optionalityMigration, /set skip_allowed = true/);
  assert.match(optionalityMigration, /check \(skip_allowed\)/);
  assert.doesNotMatch(migration, /Blocking clarification questions must be answered/);
});

test("V3 publish creates an immutable V2 version and advances the profile atomically", () => {
  assert.match(migration, /insert into public\.company_profile_versions/);
  assert.match(migration, /'v2'/);
  assert.match(migration, /profile_version_id/);
  assert.match(migration, /set current_version_id = published_version\.id/);
  assert.match(migration, /set state = 'approved'/);
  assert.match(migration, /event_type[\s\S]*'published'/);
});

test("V3 publish freezes normalized children instead of mutating draft rows", () => {
  assert.match(migration, /insert into public\.company_business_models/);
  assert.match(migration, /insert into public\.company_offering_versions/);
  assert.match(migration, /insert into public\.buyer_archetype_hypotheses/);
  assert.match(migration, /insert into public\.commercial_rules/);
  assert.doesNotMatch(migration, /update public\.company_offering_versions/);
});
