import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/discovery-v2/initial-discovery-stage.ts", "utf8");
const adapter = readFileSync("src/server/discovery-v2/plan-discovery.ts", "utf8");
const compiler = readFileSync(
  "src/lib/discovery-v2/market-research-plan-adapter.ts",
  "utf8",
);

test("new discovery runs require the run's Market Research Plan", () => {
  assert.match(stage, /loadMarketResearchPlanForDiscovery/);
  assert.match(stage, /compileAndPersistDiscoveryPlanFromMarketResearch/);
  assert.match(stage, /if \(!marketResearchPlan\)/);
  assert.doesNotMatch(stage, /compileAndPersistDiscoveryPlan\(/);
  assert.match(adapter, /\.eq\("campaign_run_id", input\.campaignRunId\)/);
});

test("frozen discovery plans remain replayable without a Strategy fallback", () => {
  assert.doesNotMatch(stage, /else \{[\s\S]+compileAndPersistDiscoveryPlan\(/);
  assert.match(stage, /if \(existingPlanRecord\)/);
  assert.match(compiler, /marketResearchPlanVersionId/);
  assert.match(adapter, /loadProviderCapabilitySnapshots/);
});
