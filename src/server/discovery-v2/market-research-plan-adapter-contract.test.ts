import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const stage = readFileSync("src/server/discovery-v2/initial-discovery-stage.ts", "utf8");
const adapter = readFileSync("src/server/discovery-v2/plan-discovery.ts", "utf8");
const compiler = readFileSync(
  "src/lib/discovery-v2/market-research-plan-adapter.ts",
  "utf8",
);

test("new discovery runs prefer a pre-run Market Research Plan", () => {
  assert.match(stage, /loadMarketResearchPlanForDiscovery/);
  assert.match(stage, /compileAndPersistDiscoveryPlanFromMarketResearch/);
  assert.ok(
    stage.indexOf("if (marketResearchPlan)") <
      stage.indexOf("compileAndPersistDiscoveryPlan({"),
  );
  assert.match(adapter, /\.lte\("created_at", input\.runCreatedAt\)/);
});

test("historical and unadapted runs retain the Strategy planner fallback", () => {
  assert.match(stage, /else \{[\s\S]+compileAndPersistDiscoveryPlan\(/);
  assert.match(stage, /if \(existingPlanRecord\)/);
  assert.match(compiler, /marketResearchPlanVersionId/);
  assert.match(adapter, /loadProviderCapabilitySnapshots/);
});
