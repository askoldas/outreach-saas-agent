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
const firstRunActivationMigration = source(
  "supabase/migrations/20260728003200_allow_first_run_controlled_beta.sql",
);
const defaultV2Migration = source(
  "supabase/migrations/20260729000100_default_v2_and_freeze_legacy.sql",
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

test("postponed benchmark evidence remains visible after V2 becomes canonical", () => {
  assert.match(readiness, /key: "benchmark_evidence"/);
  assert.match(readiness, /passed: false/);
  assert.match(readiness, /required: false/);
  assert.match(settings, /V2 canonical/);
  assert.match(settings, /V1 creation and workspace\s+rollback routing are frozen/);
});

test("rollback preserves V2 history and atomically disables new workspace routing", () => {
  assert.match(migration, /rollback_workspace_intelligence_v2/);
  assert.match(migration, /campaign_workflow = 'v1'/);
  assert.match(migration, /profile_version = 'v1'/);
  assert.match(migration, /result_write_mode = 'none'/);
  assert.match(migration, /preservedV2CampaignCount/);
  assert.doesNotMatch(migration, /delete from public\.campaign/);
});

test("readiness preparation alone cannot activate a workspace", () => {
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

test("a designated test workspace may activate before retaining a fresh V2 run", () => {
  assert.match(firstRunActivationMigration, /freshValidationRequired', true/);
  assert.match(firstRunActivationMigration, /priorRunGateWaived/);
  assert.doesNotMatch(firstRunActivationMigration, /reviewable_run_count = 0 then/);
  assert.doesNotMatch(
    firstRunActivationMigration,
    /unresolved_entity_case_count > 0 then/,
  );
  assert.match(firstRunActivationMigration, /'controlled_beta_enabled'/);
});

test("WP-22 revokes the superseded beta activation and rollback controls", () => {
  assert.match(
    defaultV2Migration,
    /revoke all on function public\.rollback_workspace_intelligence_v2/,
  );
  assert.match(
    defaultV2Migration,
    /revoke all on function public\.enable_workspace_controlled_beta_v2/,
  );
  assert.doesNotMatch(settings, /enableWorkspaceControlledBetaAction/);
  assert.doesNotMatch(settings, /rollbackWorkspaceIntelligenceAction/);
});
