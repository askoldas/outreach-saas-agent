import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260729000900_release_failed_v2_campaigns.sql",
  "utf8",
);

test("terminal V2 failures release the campaign for a fresh run", () => {
  assert.match(
    migration,
    /'ready_for_review', 'completed', 'completed_partial', 'cancelled', 'failed'/,
  );
  assert.doesNotMatch(migration, /when target_status = 'failed' then 'paused'/);
});

test("existing campaigns whose latest V2 run failed are released", () => {
  assert.match(migration, /update public\.campaigns campaign/i);
  assert.match(migration, /campaign_run\.workflow_version = 'v2'/i);
  assert.match(migration, /select campaign_run\.status/i);
  assert.match(migration, /where campaign\.status = 'paused'/i);
});
