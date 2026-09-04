import assert from "node:assert/strict";
import test from "node:test";
import { compileMarketEvidenceSynthesisInput } from "./market-evidence-selection.ts";

test("market synthesis selection represents every wave and evidence category", () => {
  const questions = [1, 2, 3].map((waveNumber) => ({ id:`q${waveNumber}`, purpose:"buyer_landscape", query:"q", rationale:"r", waveNumber, direction: waveNumber === 1 ? "initial" : "lane_validation", derivedFromEvidenceIds:[] }));
  const categoryTexts = ["buyer venue", "local terminology", "association directory", "capacity scale", "opening procurement", "market structure supply chain", "however risk gap"];
  const evidence = [1,2,3].flatMap((wave) => Array.from({length:20}, (_, index) => ({
    id:`e${wave}-${index}`, questionId:`q${wave}`, sourceFamily:index === 2 ? "association" : "web_search",
    url:`https://example${wave}.com/${index}`, title:categoryTexts[index % categoryTexts.length], excerpt:categoryTexts[index % categoryTexts.length], relevanceScore:1-index/100, retrievedAt:"2026-09-04T00:00:00.000Z",
  })));
  const selected = compileMarketEvidenceSynthesisInput({ questions, evidence, waves:[1,2,3].map((waveNumber) => ({waveNumber,questionIds:[`q${waveNumber}`],evidenceIds:evidence.filter((e)=>e.questionId===`q${waveNumber}`).map(({id})=>id),priorityGapKeys:[]})), waveSummaries:[] } as never);
  assert.deepEqual(Object.keys(selected.omittedEvidenceStats.byWave), ["1","2","3"]);
  assert.equal(selected.selectedEvidence.length, 30);
  for (const count of Object.values(selected.omittedEvidenceStats.byCategory)) assert.ok(count > 0);
});
