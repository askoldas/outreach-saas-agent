import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260730000800_fix_workspace_clear_ranking_qualification_order.sql",
  ),
  "utf8",
);

test("workspace cleanup removes Ranking before delegating to Qualification cleanup", () => {
  assert.match(
    migration,
    /rename to clear_workspace_data_before_ranking_qualification_order_v2/,
  );
  const rankEntries = migration.indexOf(
    "delete from public.candidate_rank_entries",
  );
  const rankSnapshots = migration.indexOf(
    "delete from public.candidate_rank_snapshots",
  );
  const comparativeAnomalies = migration.indexOf(
    "delete from public.comparative_anomalies",
  );
  const comparativeMembers = migration.indexOf(
    "delete from public.comparative_batch_members",
  );
  const comparativeBatches = migration.indexOf(
    "delete from public.comparative_batches",
  );
  const delegatedCleanup = migration.indexOf(
    "perform public.clear_workspace_data_before_ranking_qualification_order_v2",
  );

  assert.ok(rankEntries >= 0);
  assert.ok(rankEntries < rankSnapshots);
  assert.ok(rankSnapshots < comparativeAnomalies);
  assert.ok(comparativeAnomalies < comparativeMembers);
  assert.ok(comparativeMembers < comparativeBatches);
  assert.ok(comparativeBatches < delegatedCleanup);
});

test("ranking cleanup remains admin-only and tenant scoped", () => {
  assert.match(
    migration,
    /if not public\.is_workspace_admin\(target_workspace_id\)/,
  );
  assert.match(
    migration,
    /perform set_config\(\s*'app\.workspace_cleanup_id',\s*target_workspace_id::text,\s*true\s*\)/,
  );
  assert.match(
    migration,
    /revoke all on function\s+public\.clear_workspace_data_before_ranking_qualification_order_v2\(uuid\)\s+from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\)\s+to authenticated;/,
  );
});
