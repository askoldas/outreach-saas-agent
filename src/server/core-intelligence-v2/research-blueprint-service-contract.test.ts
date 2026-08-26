import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/research-blueprint-service.ts",
  "utf8",
);
const stage = readFileSync("src/server/candidate-research-v2/stage-service.ts", "utf8");

test("Research Blueprint service compiles exact Target Model and Market Analysis versions", () => {
  assert.match(service, /loadMarketAnalysisVersion/);
  assert.match(service, /loadCampaignTargetModelVersion/);
  assert.match(service, /compileResearchBlueprints/);
  assert.match(service, /target\.campaignId !== input\.campaignId/);
  assert.match(service, /latestVersionNumber/);
  assert.match(service, /persistResearchBlueprint/);
});

test("Candidate research loads blueprints bound to the run-eligible research plan", () => {
  assert.match(stage, /loadMarketResearchPlanForDiscovery/);
  assert.match(stage, /loadLatestResearchBlueprints/);
  assert.match(
    stage,
    /campaignTargetModelVersionId:\s*marketResearchPlan\.campaignTargetModelVersionId/,
  );
  assert.match(
    stage,
    /marketAnalysisVersionId:\s*marketResearchPlan\.marketAnalysisVersionId/,
  );
  assert.match(stage, /researchBlueprints,/);
});
