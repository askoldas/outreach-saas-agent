import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/market-analysis-v2/market-reconnaissance.ts",
  "utf8",
);
const stage = readFileSync("src/server/market-analysis-v2/stage-service.ts", "utf8");

test("market reconnaissance is cached, credit bounded, and separate from candidate discovery", () => {
  assert.match(service, /marketResearchRequestHash/);
  assert.match(service, /findCached/);
  assert.match(service, /runBudgetedTavilyCall/);
  assert.match(service, /company_research_market_reconnaissance/);
  assert.match(service, /deduplicateEvidence/);
  assert.doesNotMatch(service, /executeAndPersistDiscoveryProvider/);
});

test("Market Analysis receives the persisted evidence corpus and its allowed IDs", () => {
  assert.match(stage, /executeMarketReconnaissance/);
  assert.match(stage, /marketEvidenceSynthesis: synthesisEvidence/);
  assert.match(stage, /selectedEvidence\.map/);
  assert.doesNotMatch(stage, /evidenceIds\.push\(\.\.\.reconnaissance\.corpus\.evidence\.map/);
  assert.ok(
    stage.indexOf("executeMarketReconnaissance({") <
      stage.indexOf("compileAndPersistMarketAnalysis({"),
  );
});

test("adaptive reconnaissance enforces bounded waves, calls, evidence, and runtime", () => {
  assert.match(service, /maxMarketResearchWaves/);
  assert.match(service, /maxQueriesPerWave/);
  assert.match(service, /policy\.maxProviderCalls - responses\.length/);
  assert.match(service, /Date\.now\(\) - startedAt >= policy\.maxRuntimeMs/);
  assert.match(service, /slice\(0, policy\.maxEvidenceItems\)/);
  assert.match(service, /priorityGaps\.length > 0/);
  assert.match(service, /compileMarketResearchFollowUpQuestions/);
});
