import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260730000900_fix_workspace_clear_entity_resolution_order.sql",
    import.meta.url,
  ),
  "utf8",
);

test("workspace cleanup removes entity-resolution dependents before delegation", () => {
  const splitIndex = migration.indexOf(
    "delete from public.organization_split_events",
  );
  const sourceLinkIndex = migration.indexOf(
    "delete from public.organization_source_links",
  );
  const mergeIndex = migration.indexOf(
    "delete from public.organization_merge_events",
  );
  const delegateIndex = migration.indexOf(
    "perform public.clear_workspace_data_before_entity_resolution_order_v2",
  );

  assert.ok(splitIndex >= 0);
  assert.ok(sourceLinkIndex > splitIndex);
  assert.ok(mergeIndex > sourceLinkIndex);
  assert.ok(delegateIndex > mergeIndex);
});

test("entity-resolution cleanup remains admin-only and tenant scoped", () => {
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
    3,
  );
  assert.match(
    migration,
    /revoke all on function\s+public\.clear_workspace_data_before_entity_resolution_order_v2\(uuid\)\s+from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.clear_workspace_data\(uuid\)\s+to authenticated;/,
  );
});
