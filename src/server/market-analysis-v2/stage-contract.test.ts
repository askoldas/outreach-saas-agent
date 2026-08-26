import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/market-analysis-v2/stage-service.ts", "utf8");
const workflow = readFileSync("src/server/workflow-v2/stage-service.ts", "utf8");
const contracts = readFileSync("src/lib/workflow-v2/contracts.ts", "utf8");
const strategyTask = readFileSync("src/trigger/compile-campaign-strategy-v2.ts", "utf8");

test("Market Analysis is a durable Campaign V2 stage before Discovery", () => {
  assert.ok(contracts.indexOf('"market_analysis"') < contracts.indexOf('"discover"'));
  assert.match(workflow, /input\.stage === "market_analysis"/);
  assert.match(workflow, /executeMarketAnalysisStage/);
});

test("stage persists canonical run artifacts and preserves the confirmed Strategy", () => {
  assert.match(stage, /compileAndPersistCommercialIntelligence/);
  assert.match(stage, /compileAndPersistCampaignTargetModel/);
  assert.match(stage, /strategyProjection: context\.strategy/);
  assert.match(stage, /compileAndPersistMarketAnalysis/);
  assert.match(stage, /campaignStrategyVersionId: context\.strategyVersionId/);
  assert.match(stage, /compileAndPersistMarketResearchPlan/);
  assert.match(stage, /campaignRunId: input\.campaignRunId/);
  assert.match(stage, /createIntelligenceAttemptRecorder/);
});

test("Strategy compilation no longer duplicates Market Analysis", () => {
  assert.doesNotMatch(strategyTask, /market_context/);
});
