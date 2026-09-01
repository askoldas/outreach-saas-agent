import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const discovery = readFileSync("src/server/discovery-v2/provider-service.ts", "utf8");
const research = readFileSync("src/server/candidate-research-v2/candidate-worker.ts", "utf8");
const qualification = readFileSync("src/server/qualification-v2/candidate-worker.ts", "utf8");
const parent = readFileSync("src/trigger/execute-campaign-v2.ts", "utf8");
const targeted = readFileSync("src/server/discovery-v2/targeted-discovery-stage.ts", "utf8");

test("paid Company Research providers pass through deterministic budget guards", () => {
  assert.match(discovery, /runBudgetedTavilyCall/);
  assert.match(research, /runBudgetedOpenRouterCall/);
  assert.match(qualification, /runBudgetedOpenRouterCall/);
});

test("research interleaves one search pass with entity and evaluation work", () => {
  assert.doesNotMatch(targeted, /while \(latestDecision\.decision_json\.decision === "continue"\)/);
  assert.match(targeted, /if \(latestDecision\.decision_json\.decision === "continue"\)/);
  assert.match(parent, /continuationAction/);
  assert.match(parent, /MAX_ADAPTIVE_RESEARCH_CYCLES/);
  assert.match(parent, /persistEvolvingMarketOverview/);
});
