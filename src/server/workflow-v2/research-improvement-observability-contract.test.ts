import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");
const parent = source("src/trigger/execute-campaign-v2.ts");
const workflow = source("src/server/workflow-v2/stage-service.ts");
const market = source("src/server/market-analysis-v2/stage-service.ts");
const discovery = source("src/server/discovery-v2/initial-discovery-stage.ts");
const candidateResearch = source("src/server/candidate-research-v2/stage-service.ts");
const researchFanOut = source("src/trigger/research-campaign-candidates-v2.ts");
const qualification = source("src/server/qualification-v2/stage-service.ts");
const ranking = source("src/server/ranking-v2/stage-service.ts");

test("the active Trigger workflow uses the refactored production stages", () => {
  assert.match(parent, /bootstrapCompanyResearchContextV2Task\.triggerAndWait/);
  assert.match(parent, /runCampaignV2StageTask\.triggerAndWait/);
  assert.match(workflow, /executeSemanticDiscoveryStage\(input\)/);
  assert.match(workflow, /executeEntityResolutionStage\(input\)/);
  assert.match(workflow, /adapters\.researchCandidates\(\)/);
  assert.match(workflow, /adapters\.qualifyCandidates\(\)/);
  assert.match(workflow, /executeRankingStage\(input\)/);
  assert.doesNotMatch(parent, /allowLegacyStrategyDiscovery/);
});

test("Gemoss-style benchmark questions have compact durable answers", () => {
  assert.match(market, /initialHypotheses/);
  assert.match(market, /opportunityLanes/);
  assert.match(market, /weakOrRejectedLaneIds/);
  assert.match(market, /importantMarketSources/);
  assert.match(market, /researchWaves/);
  assert.match(market, /executedQueries/);
  assert.match(discovery, /laneSummaries/);
  assert.match(discovery, /uniquePlausibleCandidates/);
  assert.match(candidateResearch, /persistCandidateTriageDecisions/);
  assert.match(researchFanOut, /triageSummary: batch\.triageSummary/);
  assert.match(qualification, /qualificationRecommended/);
  assert.match(qualification, /qualificationExcluded/);
  assert.match(ranking, /laneCounts/);
  assert.match(ranking, /orderingPolicyVersion/);
});

test("observability remains identifiers, counts, reasons, and compact summaries", () => {
  for (const runtime of [market, discovery, candidateResearch, qualification, ranking]) {
    assert.doesNotMatch(runtime, /console\.log\([^\n]*(?:prompt|rawPayload|messages)/i);
  }
  assert.match(candidateResearch, /suppressionReasons/);
  assert.match(candidateResearch, /commercialOpportunityScore/);
  assert.match(candidateResearch, /researchDifficulty/);
  assert.match(ranking, /stableTieBreaker/);
});
