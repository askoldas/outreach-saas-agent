import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20260727000400_staged_campaign_tenant_integrity.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

test("every staged Campaign table receives a tenant-integrity trigger", () => {
  for (const table of [
    "campaign_briefs",
    "market_analyses",
    "discovery_plans",
    "discovery_paths",
    "discovery_iterations",
    "discovery_queries",
    "discovery_candidates",
    "candidate_classifications",
  ]) {
    assert.match(migration, new RegExp(`'${table}'`));
  }
  assert.match(migration, /before insert or update/i);
  assert.match(migration, /assert_staged_campaign_tenant_integrity/i);
});

test("integrity checks bind workspace, Campaign, run, plan, and candidate ancestry", () => {
  assert.match(
    migration,
    /ma\.campaign_id = r\.campaign_id[\s\S]*ma\.campaign_run_id = r\.id/,
  );
  assert.match(
    migration,
    /p\.campaign_id = r\.campaign_id[\s\S]*p\.campaign_run_id = r\.id/,
  );
  assert.match(migration, /p\.discovery_plan_id = i\.discovery_plan_id/);
  assert.match(migration, /q\.discovery_iteration_id = i\.id/);
  assert.match(migration, /c\.campaign_run_id = new\.campaign_run_id/);
});

test("authenticated clients cannot invoke the integrity function directly", () => {
  assert.match(
    migration,
    /revoke all on function public\.assert_staged_campaign_tenant_integrity\(\) from authenticated/i,
  );
});
