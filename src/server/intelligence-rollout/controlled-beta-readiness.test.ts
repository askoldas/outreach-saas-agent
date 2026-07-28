import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  assertIntelligenceExternalCallsAllowed,
  intelligenceExternalCallsAllowed,
} from "../../lib/intelligence/external-call-controls.ts";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728003000_v2_controlled_beta_readiness.sql",
);
const activationMigration = source(
  "supabase/migrations/20260728003100_enable_workspace_controlled_beta.sql",
);
const readiness = source("src/server/intelligence-rollout/readiness.ts");
const settings = source("src/features/settings/IntelligenceRolloutReadiness.tsx");

test("external-call kill switches default on and stop V2 calls explicitly", () => {
  assert.equal(intelligenceExternalCallsAllowed("provider", {}), true);
  assert.equal(
    intelligenceExternalCallsAllowed("provider", {
      INTELLIGENCE_V2_PROVIDER_CALLS_ENABLED: "false",
    }),
    false,
  );
  assert.throws(
    () =>
      assertIntelligenceExternalCallsAllowed("model", {
        INTELLIGENCE_V2_MODEL_CALLS_ENABLED: "false",
      }),
    /model calls are disabled/,
  );
});

test("controlled beta remains fail-closed while benchmark evidence is postponed", () => {
  assert.match(readiness, /key: "benchmark_evidence"/);
  assert.match(readiness, /passed: false/);
  assert.match(readiness, /required: true/);
  assert.match(settings, /Activation blocked/);
  assert.match(settings, /cannot enable V2/i);
});

test("rollback preserves V2 history and atomically disables new workspace routing", () => {
  assert.match(migration, /rollback_workspace_intelligence_v2/);
  assert.match(migration, /campaign_workflow = 'v1'/);
  assert.match(migration, /profile_version = 'v1'/);
  assert.match(migration, /result_write_mode = 'none'/);
  assert.match(migration, /preservedV2CampaignCount/);
  assert.doesNotMatch(migration, /delete from public\.campaign/);
});

test("rollout changes are auditable and activation is not implemented by this pass", () => {
  assert.match(migration, /intelligence_rollout_audit_events/);
  assert.match(migration, /public\.is_workspace_admin\(target_workspace_id\)/);
  assert.doesNotMatch(migration, /enable_workspace_intelligence_v2/);
});

test("controlled activation requires an explicit waiver and preserves non-benchmark gates", () => {
  assert.match(activationMigration, /enable_workspace_controlled_beta_v2/);
  assert.match(activationMigration, /target_benchmark_waived is not true/);
  assert.match(activationMigration, /reviewable_run_count = 0/);
  assert.match(activationMigration, /unresolved_entity_case_count > 0/);
  assert.match(activationMigration, /'controlled_beta_enabled'/);
  assert.match(activationMigration, /'benchmarkWaived', true/);
});

test("controlled activation is workspace scoped, canonical, and reversible", () => {
  assert.match(activationMigration, /public\.is_workspace_admin\(target_workspace_id\)/);
  assert.match(activationMigration, /campaign_workflow = 'v2'/);
  assert.match(activationMigration, /profile_version = 'v2'/);
  assert.match(activationMigration, /result_write_mode = 'canonical'/);
  assert.doesNotMatch(activationMigration, /update public\.campaigns/);
  assert.match(migration, /rollback_workspace_intelligence_v2/);
});
