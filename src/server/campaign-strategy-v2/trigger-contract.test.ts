import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const task = readFileSync("src/trigger/compile-campaign-strategy-v2.ts", "utf8");
const stageTask = readFileSync(
  "src/trigger/run-campaign-strategy-v2-stage.ts",
  "utf8",
);
const stageService = readFileSync(
  "src/server/campaign-strategy-v2/stage-service.ts",
  "utf8",
);
const dispatch = readFileSync("src/server/trigger/dispatch.ts", "utf8");
const actions = readFileSync("src/server/campaign-strategy-v2/actions.ts", "utf8");
const campaignActions = readFileSync("src/server/campaigns/actions.ts", "utf8");
const progress = readFileSync(
  "src/features/campaigns/CampaignStrategyV2Progress.tsx",
  "utf8",
);

test("Campaign Strategy compilation runs as a durable Trigger task", () => {
  assert.match(task, /id: "compile-campaign-strategy-v2"/);
  assert.match(task, /onFailure:/);
  assert.match(task, /runCampaignStrategyV2StageTask\.triggerAndWait/);
  assert.match(task, /stageId: "market_context"/);
  assert.match(task, /stageId: "advisory_delta"/);
  assert.ok(task.indexOf('stageId: "market_context"') < task.indexOf('stageId: "advisory_delta"'));
  assert.match(stageTask, /id: "run-campaign-strategy-v2-stage"/);
  assert.match(stageService, /claimCampaignStrategyStage/);
  assert.match(stageService, /claimed\.status === "completed"/);
  assert.match(stageService, /completeCampaignStrategyStage/);
  assert.match(stageService, /failCampaignStrategyStage/);
  assert.match(dispatch, /tasks\.trigger<typeof compileCampaignStrategyV2Task>/);
  assert.match(dispatch, /idempotencyKey:/);
});

test("campaign creation and retry enqueue Strategy compilation", () => {
  assert.match(campaignActions, /dispatchCampaignStrategyV2Compilation/);
  assert.match(actions, /dispatchCampaignStrategyV2Compilation/);
  assert.doesNotMatch(actions, /resumeInitialCampaignStrategyV2/);
});

test("building Strategy drafts refresh until compilation settles", () => {
  assert.match(progress, /router\.refresh\(\)/);
  assert.match(progress, /setInterval/);
});
