import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const parent = source("src/trigger/execute-campaign-v2.ts");
const child = source("src/trigger/run-campaign-v2-stage.ts");
const service = source("src/server/workflow-v2/stage-service.ts");
const routing = source("src/lib/intelligence/workflow-routing.ts");

test("V2 parent resumes from checkpoints and waits for durable child stages", () => {
  assert.match(parent, /id: "execute-campaign-v2"/);
  assert.match(parent, /loadCompletedCheckpointKeys/);
  assert.match(parent, /remainingCampaignStages/);
  assert.match(parent, /runCampaignV2StageTask\.triggerAndWait/);
  assert.match(parent, /campaign-v2:\$\{workflowRunId\}:\$\{stage\}/);
});

test("V2 stage execution claims and settles one logical task", () => {
  assert.match(child, /id: "run-campaign-v2-stage"/);
  assert.match(child, /ctx\.run\.id/);
  assert.match(service, /claimWorkflowTask/);
  assert.match(service, /completeWorkflowTask/);
  assert.match(service, /failWorkflowTaskAttempt/);
  assert.match(service, /saveWorkflowCheckpoint/);
});

test("V2 stages fail closed after the connected entity-resolution boundary", () => {
  assert.match(service, /input\.stage === "initialize"/);
  assert.match(service, /input\.stage === "discover"/);
  assert.match(service, /input\.stage === "resolve_entities"/);
  assert.match(service, /executeEntityResolutionStage/);
  assert.match(service, /stage adapter.*is not implemented/s);
  assert.match(routing, /not enabled yet/);
  assert.doesNotMatch(routing, /return "execute-campaign-v2"/);
});
