import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000400_campaign_agent_iteration_executions.sql",
  import.meta.url,
);

test("Campaign Agent iterations have isolated and tenant-consistent executions", async () => {
  const migration = await readFile(migrationUrl, "utf8");

  assert.match(migration, /parent_execution_id uuid references/i);
  assert.match(migration, /agent_iteration integer/i);
  assert.match(migration, /unique index provider_executions_agent_iteration_unique/i);
  assert.match(migration, /parent_row\.workspace_id <> new\.workspace_id/i);
  assert.match(
    migration,
    /parent_row\.campaign_run_id is distinct from new\.campaign_run_id/i,
  );
  assert.match(migration, /new\.operation <> 'campaign_discovery'/i);
});
