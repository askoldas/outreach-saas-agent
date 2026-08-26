import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728002800_v2_workflow_controls_and_reconciliation.sql",
);
const parent = source("src/trigger/execute-campaign-v2.ts");
const repository = source("src/server/workflow-v2/repository.ts");
const controls = source("src/server/workflow-v2/control-service.ts");
const dispatch = source("src/server/trigger/dispatch.ts");
const actions = source("src/server/campaigns/actions.ts");

test("authenticated administrators request validated durable commands", () => {
  assert.match(migration, /request_campaign_workflow_command_v2/);
  assert.match(migration, /public\.is_workspace_admin/);
  assert.match(migration, /workflow_commands_one_pending_type_idx/);
  assert.match(migration, /campaign_v2\.command_requested/);
  assert.match(migration, /to authenticated/);
});

test("service-role control consumption applies pause, resume, and terminal cancel atomically", () => {
  assert.match(migration, /consume_campaign_workflow_control_v2/);
  assert.match(migration, /if command\.command_type = 'cancel'/);
  assert.match(migration, /status = 'cancelled'/);
  assert.match(migration, /status = 'paused'/);
  assert.match(migration, /current_phase = 'resume_queued'/);
  assert.match(migration, /campaign_v2\.command_processed/);
  assert.match(migration, /to service_role/);
});

test("the parent checks controls before and after every durable child stage", () => {
  assert.match(parent, /initialControl/);
  assert.match(parent, /beforeStage/);
  assert.match(parent, /afterStage/);
  assert.match(parent, /consumeWorkflowControl/);
  assert.match(parent, /stagesForResearchCycle/);
});

test("workflow settlement reconciles Campaign Run progress and terminal states", () => {
  assert.match(migration, /settle_campaign_workflow_v2/);
  assert.match(migration, /progress_percentage/);
  assert.match(migration, /completed_partial/);
  assert.match(migration, /partially_completed/);
  assert.match(
    migration,
    /workflow\.status in \([\s\S]*'ready_for_review'[\s\S]*'cancelled'/,
  );
  assert.match(repository, /loadWorkflowCandidateProgress/);
  assert.match(repository, /failedCandidateCount/);
  assert.match(parent, /\.\.\.candidateProgress/);
});

test("campaign controls route V2 runs through commands and checkpointed resume", () => {
  assert.match(actions, /controlActiveCampaignWorkflowV2/);
  assert.match(controls, /request_campaign_workflow_command_v2/);
  assert.match(controls, /dispatchCampaignV2Resume/);
  assert.match(controls, /cancelTriggerRuns/);
  assert.match(dispatch, /execute-campaign-v2-resume/);
});
