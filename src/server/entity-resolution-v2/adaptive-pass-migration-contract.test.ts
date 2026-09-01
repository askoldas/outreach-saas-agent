import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260901000300_allow_resolution_from_finalized_discovery_pass.sql",
  "utf8",
);

test("Entity Resolution accepts only a durably finalized adaptive pass", () => {
  assert.match(migration, /original_status = 'running_targeted_pass'/);
  assert.match(migration, /discovery_pass_decisions_v2/);
  assert.match(migration, /decision_json->>'decision'/);
  assert.match(migration, /order by decision\.pass_number desc/);
  assert.match(migration, /is distinct from 'continue'/);
  assert.match(
    migration,
    /raise exception 'Entity Resolution requires a finalized Discovery pass\.'/,
  );
});

test("legacy terminal resolver preconditions are adapted only transactionally", () => {
  const terminalUpdates = migration.match(/set status = 'completed'/g) ?? [];
  const restorations = migration.match(/set status = original_status/g) ?? [];
  assert.equal(terminalUpdates.length, 2);
  assert.equal(restorations.length, 2);
  assert.match(migration, /for update/);
  assert.match(
    migration,
    /materialize_campaign_organization_references_before_adaptive_pass_v2/,
  );
  assert.match(migration, /resolve_campaign_entities_before_adaptive_pass_v2/);
});

test("adaptive Entity Resolution wrappers remain service-role only", () => {
  assert.match(migration, /auth\.role\(\) <> 'service_role'/);
  assert.match(
    migration,
    /grant execute on function[\s\S]*materialize_campaign_organization_references_v2[\s\S]*to service_role/,
  );
  assert.match(
    migration,
    /grant execute on function[\s\S]*resolve_campaign_entities_v2[\s\S]*to service_role/,
  );
});
