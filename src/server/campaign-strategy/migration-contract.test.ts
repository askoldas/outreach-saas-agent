import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260719000200_create_campaign_strategy_versions.sql",
    import.meta.url,
  ),
  "utf8",
);

test("strategy versions are tenant-scoped, immutable, and linked to runs", () => {
  assert.match(migration, /create table public\.campaign_strategy_versions/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /unique \(campaign_id, version\)/i);
  assert.match(migration, /add column strategy_version_id uuid/i);
  assert.doesNotMatch(migration, /campaign_strategy_versions for update/i);
});

test("research-run insertion freezes and marks the selected strategy used", () => {
  assert.match(migration, /function public\.freeze_research_run_strategy/i);
  assert.match(migration, /before insert on public\.research_runs/i);
  assert.match(migration, /set status = 'used'/i);
});

test("strategy version creation is admin checked and supersedes only editable versions", () => {
  assert.match(migration, /is_workspace_admin\(target_workspace_id\)/i);
  assert.match(migration, /status in \('draft', 'ready'\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /grant execute .* to authenticated/i);
});
