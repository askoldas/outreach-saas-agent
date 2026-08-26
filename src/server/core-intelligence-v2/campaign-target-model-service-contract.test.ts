import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/campaign-target-model-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Campaign Target Model service loads an exact workspace-scoped Commercial version", () => {
  assert.match(service, /loadCommercialIntelligenceVersion/);
  assert.match(service, /commercialIntelligenceVersionId/);
  assert.match(repository, /loadCommercialIntelligenceVersion/);
  assert.match(repository, /\.eq\("workspace_id", input\.workspaceId\)/);
  assert.match(repository, /\.eq\("id", input\.id\)/);
  assert.match(repository, /commercialIntelligenceSchema\.parse/);
});

test("Campaign Target Model persistence is versioned and Strategy-compatible", () => {
  assert.match(service, /compileCampaignTargetModel/);
  assert.match(service, /assertCampaignTargetStrategyProjection/);
  assert.match(service, /loadLatestCampaignTargetModelVersionNumber/);
  assert.match(service, /persistCampaignTargetModel/);
  assert.match(repository, /campaign_target_model_versions_v2/);
});
