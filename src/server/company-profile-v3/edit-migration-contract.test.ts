import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000700_edit_company_intelligence_v3_core.sql",
  "utf8",
);

test("V3 core editing is one guarded draft-only operation", () => {
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/);
  assert.match(migration, /for update/);
  assert.match(migration, /not in \('needs_input', 'ready_for_review'\)/);
  assert.match(migration, /update public\.company_business_models/);
  assert.match(migration, /update public\.company_profile_drafts/);
});

test("V3 core editing validates identity and keeps snapshot and audit synchronized", () => {
  assert.match(migration, /valid canonical domain/i);
  assert.match(migration, /jsonb_set/);
  assert.match(migration, /compiled_snapshot_hash = null/);
  assert.match(migration, /core_fields_updated/);
  assert.match(migration, /profile_change_events/);
});
