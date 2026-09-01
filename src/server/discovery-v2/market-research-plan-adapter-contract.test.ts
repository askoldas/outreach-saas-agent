import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/discovery-v2/initial-discovery-stage.ts", "utf8");
const adapter = readFileSync("src/server/discovery-v2/plan-discovery.ts", "utf8");
const compiler = readFileSync(
  "src/lib/discovery-v2/market-research-plan-adapter.ts",
  "utf8",
);

test("new discovery runs enrich from a run-tied Market Research Plan when ready", () => {
  assert.match(stage, /loadMarketResearchPlanForDiscovery/);
  assert.match(stage, /compileAndPersistDiscoveryPlanFromMarketResearch/);
  assert.match(stage, /compileAndPersistStrategyDiscoveryPlan/);
  assert.match(stage, /const compiled = marketResearchPlan/);
  assert.doesNotMatch(stage, /compileAndPersistDiscoveryPlan\(/);
  assert.match(adapter, /\.eq\("campaign_run_id", input\.campaignRunId\)/);
});

test("frozen discovery plans remain replayable without recompilation", () => {
  assert.doesNotMatch(stage, /else \{[\s\S]+compileAndPersistDiscoveryPlan\(/);
  assert.match(stage, /if \(existingPlanRecord\)/);
  assert.match(compiler, /marketResearchPlanVersionId/);
  assert.match(adapter, /loadProviderCapabilitySnapshots/);
  assert.match(adapter, /freezeEnabledDiscoveryProviderCapabilities/);
});
