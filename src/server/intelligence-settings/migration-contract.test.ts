import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260728000100_intelligence_v2_versioning_and_rollout.sql",
  import.meta.url,
);

test("V2 rollout migration freezes workflow and contract versions without enabling V2", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(migration, /intelligence_version text not null default 'v1'/i);
  assert.match(migration, /workflow_version text not null default 'v1'/i);
  assert.match(migration, /contract_versions jsonb not null default '\{\}'::jsonb/i);
  assert.match(migration, /create table public\.workspace_intelligence_settings/i);
  assert.match(migration, /campaign_runs_freeze_intelligence_versions/i);
  assert.match(migration, /campaigns_freeze_intelligence_versions/i);
  assert.match(migration, /'workflowVersion',\s*target_campaign\.workflow_version/i);
});

test("workspace Intelligence settings are tenant isolated and admin controlled", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(
    migration,
    /workspace_id uuid primary key references public\.workspaces\(id\)/i,
  );
  assert.match(
    migration,
    /alter table public\.workspace_intelligence_settings enable row level security/i,
  );
  assert.match(migration, /public\.is_workspace_member\(workspace_id\)/i);
  assert.match(migration, /public\.is_workspace_admin\(workspace_id\)/i);
});
