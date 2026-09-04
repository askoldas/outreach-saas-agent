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
  assert.match(stage, /marketEvidenceCorpus: reconnaissance\.corpus/);
  assert.match(stage, /evidenceIds\.push\(\.\.\.reconnaissance\.corpus\.evidence\.map/);
  assert.ok(
    stage.indexOf("executeMarketReconnaissance({") <
      stage.indexOf("compileAndPersistMarketAnalysis({"),
  );
});
