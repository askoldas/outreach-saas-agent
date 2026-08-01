import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260729000100_default_v2_and_freeze_legacy.sql",
);
const rollout = source("src/lib/intelligence/rollout.ts");
const dispatch = source("src/server/trigger/dispatch.ts");
const settings = source("src/app/(app)/settings/page.tsx");
const strategyPage = source("src/app/(app)/campaigns/[id]/strategy/page.tsx");

test("WP-22 makes V2 canonical for new workspaces and records", () => {
  assert.match(migration, /profile_version set default 'v2'/);
  assert.match(migration, /campaign_workflow set default 'v2'/);
  assert.match(migration, /intelligence_version set default 'v2'/);
  assert.match(migration, /workflow_version set default 'v2'/);
  assert.match(migration, /result_write_mode set default 'canonical'/);
  assert.match(rollout, /campaignWorkflow: "v2"/);
  assert.match(rollout, /profileVersion: "v2"/);
  assert.match(rollout, /resultWriteMode: "canonical"/);
});

test("WP-22 blocks new V1 writes and removes workspace switching", () => {
  assert.match(migration, /New V1 Company Profile versions are frozen/);
  assert.match(migration, /New V1 Campaigns are frozen/);
  assert.match(migration, /New V1 Campaign Runs are frozen/);
  assert.match(
    migration,
    /revoke all on function public\.rollback_workspace_intelligence_v2/,
  );
  assert.doesNotMatch(settings, /rollbackWorkspaceIntelligenceAction/);
  assert.doesNotMatch(settings, /enableWorkspaceControlledBetaAction/);
});

test("historical V1 records remain readable but cannot execute", () => {
  assert.match(dispatch, /campaignRun\.workflow_version !== "v2"/);
  assert.match(dispatch, /Historical V1 Campaign Runs are read-only/);
  assert.match(dispatch, /"execute-campaign-v2"/);
  assert.match(strategyPage, /getCampaignWorkflowVersion/);
  assert.match(strategyPage, /workflowVersion === "v2"/);
  assert.match(strategyPage, /getCurrentCampaignStrategy/);
  assert.doesNotMatch(settings, /IntelligenceRolloutReadiness/);
});
