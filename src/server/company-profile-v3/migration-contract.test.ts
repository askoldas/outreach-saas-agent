import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000400_company_intelligence_v3.sql",
  "utf8",
);

test("WP-05 draft migration creates normalized V3 profile stores", () => {
  for (const table of [
    "company_profile_drafts",
    "company_business_models",
    "company_business_roles",
    "company_offerings",
    "company_offering_versions",
    "buyer_archetype_hypotheses",
    "commercial_rules",
    "profile_clarification_questions",
    "profile_task_runs",
    "profile_change_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /alter table public\.%I enable row level security/);
});

test("V3 draft persistence is tenant guarded and idempotent", () => {
  assert.match(migration, /validate_company_v3_workspace/);
  assert.match(migration, /validate_company_v3_child_workspace/);
  assert.match(migration, /Cross-workspace Company Intelligence V3/);
  assert.match(migration, /unique \(company_profile_id, input_hash\)/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /create_company_profile_v3_draft/);
});

test("published V3 child records are immutable while drafts remain reviewable", () => {
  assert.match(migration, /prevent_published_v3_child_mutation/);
  assert.match(migration, /Published Company Intelligence V3 records are immutable/);
  assert.match(migration, /source <> 'ai' or status = 'proposed'/);
});
