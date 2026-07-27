import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260728000800_campaign_strategy_v2.sql",
  "utf8",
);

test("WP-08 creates Campaign Strategy V2 draft and normalized persistence", () => {
  for (const table of [
    "campaign_inputs",
    "campaign_strategy_drafts",
    "campaign_objectives",
    "campaign_buyer_archetypes",
    "campaign_qualification_rubrics",
    "campaign_qualification_factor_definitions",
    "campaign_rules_v2",
    "campaign_source_plans",
    "campaign_strategy_diffs",
    "campaign_strategy_events",
  ]) {
    assert.match(migration, new RegExp(`create table public\\.${table}`));
  }
  assert.match(migration, /profile_intelligence_version_id uuid not null/i);
  assert.match(migration, /compiled_context_hash text/i);
});

test("WP-08 confirmation is one audited immutable version transaction", () => {
  assert.match(
    migration,
    /create or replace function public\.confirm_campaign_strategy_v2/i,
  );
  assert.match(migration, /Objective and geography require explicit user confirmation/i);
  assert.match(migration, /Legacy strategy imports require review and recompilation/i);
  assert.match(migration, /confirmation_status, confirmed_by, confirmed_at/i);
  assert.match(migration, /'strategy_confirmed', 'user', auth\.uid\(\)/i);
  assert.match(migration, /current_strategy_version_id = saved_version\.id/i);
});

test("WP-08 is tenant guarded, RLS protected, and RPC access is constrained", () => {
  assert.match(migration, /Cross-workspace Campaign Strategy V2 association/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /is_workspace_member\(workspace_id\)/i);
  assert.match(migration, /is_workspace_admin\(workspace_id\)/i);
  assert.match(migration, /revoke all on function public\.confirm_campaign_strategy_v2/i);
  assert.match(migration, /to authenticated;/i);
});
