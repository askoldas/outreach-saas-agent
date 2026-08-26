import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/market-research-plan-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Research Plan loads exact analysis, target, and workspace-scoped capability snapshots", () => {
  assert.match(service, /loadMarketAnalysisVersion/);
  assert.match(service, /loadCampaignTargetModelVersion/);
  assert.match(service, /loadProviderCapabilitySnapshots/);
  assert.match(service, /isMarketAnalysisConfirmed/);
  assert.match(repository, /market_analysis_confirmations_v2/);
  assert.match(repository, /discovery_provider_capability_snapshots/);
  assert.match(repository, /discoveryProviderCapabilitiesSchema\.parse/);
});

test("Research Plan is compiled without a model call and persisted immutably", () => {
  assert.match(service, /compileMarketResearchPlan/);
  assert.doesNotMatch(service, /generateCampaignMarketContext|generateTextResult/);
  assert.match(service, /loadLatestMarketResearchPlanVersionNumber/);
  assert.match(service, /persistMarketResearchPlan/);
  assert.match(repository, /market_research_plan_versions_v2/);
});
