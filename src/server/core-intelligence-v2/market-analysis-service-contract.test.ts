import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/market-analysis-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Market Analysis uses the validated shared model runtime and exact Target Model", () => {
  assert.match(service, /generateCampaignMarketContext/);
  assert.match(service, /loadCampaignTargetModelVersion/);
  assert.match(service, /target\.campaignId !== input\.campaignId/);
  assert.match(service, /compileMarketAnalysis/);
  assert.match(repository, /campaignTargetModelSchema\.parse/);
});

test("Market Analysis persists provenance and a Campaign Run-scoped version", () => {
  assert.match(service, /campaignV2TaskContracts\.marketContext\.promptVersion/);
  assert.match(service, /modelRole: "campaign_strategy_reasoning"/);
  assert.match(service, /requestedModel: result\.call\.requestedModel/);
  assert.match(service, /fallbackUsed: result\.call\.fallbackUsed/);
  assert.match(service, /loadLatestMarketAnalysisVersionNumber/);
  assert.match(service, /persistMarketAnalysis/);
  assert.match(repository, /\.eq\("campaign_run_id", input\.campaignRunId\)/);
});
