import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const parent = source("src/trigger/execute-campaign-v2.ts");
const child = source("src/trigger/run-campaign-v2-stage.ts");
const researchChild = source("src/trigger/research-campaign-candidates-v2.ts");
const qualificationChild = source("src/trigger/qualify-campaign-candidates-v2.ts");
const service = source("src/server/workflow-v2/stage-service.ts");
const dispatch = source("src/server/trigger/dispatch.ts");
const bootstrap = source("src/trigger/bootstrap-company-research-context-v2.ts");

test("V2 parent resumes from checkpoints and waits for durable child stages", () => {
  assert.match(parent, /id: "execute-campaign-v2"/);
  assert.match(parent, /loadCompletedCheckpointKeys/);
  assert.match(parent, /stagesForResearchCycle/);
  assert.match(parent, /runCampaignV2StageTask\.triggerAndWait/);
  assert.match(parent, /campaign-v2:\$\{workflowRunId\}:cycle-\$\{cycleNumber\}:\$\{stage\}/);
  assert.match(parent, /consumeWorkflowControl/);
  assert.match(parent, /beforeStage/);
  assert.match(parent, /afterStage/);
});

test("Market Overview enrichment never blocks initial discovery", () => {
  assert.match(parent, /bootstrapCompanyResearchContextV2Task\.trigger\(/);
  assert.doesNotMatch(parent, /bootstrapCompanyResearchContextV2Task\.triggerAndWait/);
  assert.match(bootstrap, /executeCompanyResearchBootstrap/);
  assert.doesNotMatch(service, /executeCompanyResearchBootstrap/);
});

test("V2 stage execution claims and settles one logical task", () => {
  assert.match(child, /id: "run-campaign-v2-stage"/);
  assert.match(child, /ctx\.run\.id/);
  assert.match(service, /claimWorkflowTask/);
  assert.match(service, /completeWorkflowTask/);
  assert.match(service, /failWorkflowTaskAttempt/);
  assert.match(service, /saveWorkflowCheckpoint/);
});

test("V2 stages connect through deterministic Comparative Ranking", () => {
  assert.match(service, /input\.stage === "initialize"/);
  assert.match(service, /input\.stage === "discover"/);
  assert.match(service, /input\.stage === "resolve_entities"/);
  assert.match(service, /executeEntityResolutionStage/);
  assert.match(service, /input\.stage === "research_candidates"/);
  assert.match(service, /adapters\.researchCandidates/);
  assert.match(child, /executeCandidateResearchFanOut/);
  assert.match(researchChild, /id: "research-campaign-candidate-v2"/);
  assert.match(researchChild, /batchTriggerAndWait/);
  assert.match(researchChild, /concurrencyLimit: 4/);
  assert.match(service, /input\.stage === "qualify_candidates"/);
  assert.match(service, /adapters\.qualifyCandidates/);
  assert.match(child, /executeQualificationFanOut/);
  assert.match(qualificationChild, /id: "qualify-campaign-candidate-v2"/);
  assert.match(qualificationChild, /batchTriggerAndWait/);
  assert.match(qualificationChild, /concurrencyLimit: 4/);
  assert.match(service, /input\.stage === "rank_candidates"/);
  assert.match(service, /executeRankingStage/);
  assert.match(service, /stage adapter.*is not implemented/s);
  assert.match(dispatch, /"execute-campaign-v2"/);
  assert.match(dispatch, /Historical V1 Campaign Runs are read-only/);
});
