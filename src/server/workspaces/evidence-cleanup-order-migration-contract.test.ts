import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260730001000_fix_workspace_clear_evidence_provider_order.sql",
    import.meta.url,
  ),
  "utf8",
);

test("workspace cleanup removes every evidence dependent before evidence", () => {
  const memberSourcesIndex = migration.indexOf(
    "delete from public.candidate_research_member_sources_v2",
  );
  const researchTasksIndex = migration.indexOf(
    "delete from public.candidate_research_tasks",
  );
  const memoryLinksIndex = migration.indexOf(
    "delete from public.memory_evidence_links",
  );
  const claimLinksIndex = migration.indexOf(
    "delete from public.claim_evidence_links",
  );
  const evidenceIndex = migration.indexOf(
    "delete from public.evidence_items",
  );
  const delegateIndex = migration.indexOf(
    "perform public.clear_workspace_data_before_evidence_provider_order_v2",
  );

  assert.ok(memberSourcesIndex >= 0);
  assert.ok(researchTasksIndex > memberSourcesIndex);
  assert.ok(memoryLinksIndex > researchTasksIndex);
  assert.ok(claimLinksIndex > memoryLinksIndex);
  assert.ok(evidenceIndex > claimLinksIndex);
  assert.ok(delegateIndex > evidenceIndex);
});

test("evidence cleanup restores the scoped immutability exception", () => {
  assert.match(
    migration,
    /create or replace function public\.prevent_evidence_claim_mutation\(\)/,
  );
  assert.match(
    migration,
    /current_setting\('app\.workspace_cleanup_id', true\) = old\.workspace_id::text/,
  );
  assert.match(migration, /if tg_op = 'DELETE' then\s+return old;/);
});

test("evidence cleanup remains admin-only and tenant scoped", () => {
  assert.match(
    migration,
    /if not public\.is_workspace_admin\(target_workspace_id\) then/,
  );
  assert.match(
    migration,
    /set_config\(\s*'app\.workspace_cleanup_id',\s*target_workspace_id::text,\s*true\s*\)/,
  );
  assert.equal(
    (
      migration.match(
        /where workspace_id = target_workspace_id;/g,
      ) ?? []
    ).length,
    5,
  );
  assert.match(
    migration,
    /revoke all on function\s+public\.clear_workspace_data_before_evidence_provider_order_v2\(uuid\)\s+from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\)\s+to authenticated;/,
  );
});
