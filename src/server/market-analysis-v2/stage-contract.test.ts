import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/market-analysis-v2/stage-service.ts", "utf8");
const workflow = readFileSync("src/server/workflow-v2/stage-service.ts", "utf8");
const contracts = readFileSync("src/lib/workflow-v2/contracts.ts", "utf8");
const strategyTask = readFileSync("src/trigger/compile-campaign-strategy-v2.ts", "utf8");
const bootstrapTask = readFileSync(
  "src/trigger/bootstrap-company-research-context-v2.ts",
  "utf8",
);
const executionTask = readFileSync("src/trigger/execute-campaign-v2.ts", "utf8");
const discoveryStage = readFileSync(
  "src/server/discovery-v2/initial-discovery-stage.ts",
  "utf8",
);

test("market context bootstraps Company Research without a standalone stage", () => {
  const activeStages = contracts.slice(
    contracts.indexOf("export const campaignV2Stages"),
    contracts.indexOf("export const historicalCampaignV2Stages"),
  );
  assert.doesNotMatch(activeStages, /"market_analysis"/);
  assert.match(contracts, /historicalCampaignV2Stages = \["market_analysis"\]/);
  assert.match(workflow, /executeHistoricalMarketAnalysisStage/);
  assert.match(workflow, /input\.stage === "initialize"/);
  assert.doesNotMatch(workflow, /executeCompanyResearchBootstrap/);
  assert.match(bootstrapTask, /executeCompanyResearchBootstrap/);
  assert.match(executionTask, /bootstrapCompanyResearchContextV2Task\.trigger/);
  assert.doesNotMatch(executionTask, /bootstrapCompanyResearchContextV2Task\.triggerAndWait/);
  assert.match(discoveryStage, /compileAndPersistStrategyDiscoveryPlan/);
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
  assert.match(stage, /runBudgetedOpenRouterCall/);
  assert.match(stage, /company_research\.market_overview_bootstrap/);
});

test("Strategy compilation no longer duplicates Market Analysis", () => {
  assert.doesNotMatch(strategyTask, /market_context/);
});
