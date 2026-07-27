import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../supabase/migrations/20260726000900_sync_campaign_market_revisions.sql",
  import.meta.url,
);

test("strategy revisions atomically synchronize campaign and confirmed brief targeting", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.match(
    migration,
    /create or replace function public\.save_clean_campaign_strategy_version/,
  );
  assert.match(migration, /for update/);
  assert.match(migration, /target_campaign\.status = 'active'/);
  assert.match(migration, /update public\.campaigns/);
  assert.match(migration, /current_strategy_version_id = saved\.id/);
  assert.match(migration, /update public\.campaign_briefs/);
  assert.match(migration, /'desiredQualifiedCompanies', target_count/);
  assert.match(migration, /'recommendedDecisionMakerRoles'/);
  assert.match(migration, /is_workspace_admin/);
});
