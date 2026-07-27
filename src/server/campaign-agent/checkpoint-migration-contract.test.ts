import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000300_campaign_agent_checkpoints.sql",
  import.meta.url,
);

test("Campaign Agent checkpoints are tenant-scoped and retry-safe", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /workspace_id uuid not null/i);
  assert.match(migration, /campaign_run_id uuid not null/i);
  assert.match(migration, /unique \(campaign_run_id, iteration, phase\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /is_workspace_member\(workspace_id\)/i);
  assert.match(migration, /checkpoint workspace does not match Campaign Run/i);
});
