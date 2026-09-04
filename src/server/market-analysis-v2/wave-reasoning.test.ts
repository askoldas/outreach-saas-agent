import assert from "node:assert/strict";
import test from "node:test";
import { compileMarketResearchFollowUpQuestions, sanitizeMarketResearchWaveSummary } from "../../lib/intelligence/core/index.ts";
import { readFileSync } from "node:fs";

const implementation = readFileSync("src/server/market-analysis-v2/wave-reasoning.ts", "utf8");

const finding = (label:string, relationshipType:string, evidenceIds=["e1"]) => ({label,relationshipType,rationale:"Wave 1 supports this",confidence:.9,evidenceIds});
const summary = { waveNumber:1 as const, discoveredLaneHypotheses:[finding("conference venues","buyer"),finding("distributors","distributor")], strengthenedLaneHypotheses:[],weakenedLaneHypotheses:[],localTerminology:[finding("konferenču centri","buyer")],importantSourceLeads:[],scaleDriverFindings:[],buyingSignalFindings:[],marketStructureFindings:[],evidenceGaps:[],followUpQuestions:[],evidenceIds:["e1","hidden"] };

test("Wave-1 reasoning preserves provenance and campaign relationship boundary", () => {
  const clean = sanitizeMarketResearchWaveSummary(summary, new Set(["e1"]), new Set(["buyer"]));
  assert.deepEqual(clean.evidenceIds,["e1"]);
  assert.deepEqual(clean.discoveredLaneHypotheses.map(({label})=>label),["conference venues"]);
  assert.ok(clean.weakenedLaneHypotheses.some(({label})=>label === "distributors"));
});

test("Wave-2 plan targets a supported newly discovered lane", () => {
  const target = { geography:{displayName:"Latvia"}, objective:{desiredRelationships:["buyer"]} } as never;
  const questions = compileMarketResearchFollowUpQuestions({target,evidence:[{id:"e1",url:"https://example.com",title:"Banquet kitchens",excerpt:"event venues",relevanceScore:.9}],waveNumber:2,waveSummary:sanitizeMarketResearchWaveSummary(summary,new Set(["e1"]),new Set(["buyer"])),maximum:3});
  assert.match(questions[0]!.query,/conference venues/i);
  assert.deepEqual(questions[0]!.derivedFromEvidenceIds,["e1"]);
});

test("Wave-1 reasoning uses portable JSON mode and validates the result locally", () => {
  assert.match(implementation, /jsonMode: true/);
  assert.doesNotMatch(implementation, /jsonSchema:/);
  assert.match(implementation, /marketResearchWaveSummarySchema\.parse/);
  assert.match(implementation, /sanitizeMarketResearchWaveSummary/);
});
