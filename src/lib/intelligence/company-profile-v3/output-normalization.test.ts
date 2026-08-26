import assert from "node:assert/strict";
import test from "node:test";
import {
  profileBuyerLogicShardOutputSchema,
  profileFactExtractionOutputSchema,
} from "./task-contracts.ts";
import { normalizeProfileStageProviderOutput } from "./output-normalization.ts";

test("fact normalization preserves atomic values and canonicalizes structures", () => {
  const raw = JSON.stringify({
    facts: [
      fact("scalar", "value"),
      fact("list", ["one", "two"]),
      fact("object", { markets: ["LV", "LT"] }),
      fact("mixed", ["LV", { country: "LT" }]),
      fact("empty", null),
    ],
    sourceConflicts: [],
    sourceLimitations: [],
  });
  const normalized = JSON.parse(
    normalizeProfileStageProviderOutput("profile.fact_extraction", raw),
  );
  const parsed = profileFactExtractionOutputSchema.parse(normalized);
  assert.deepEqual(
    parsed.facts.map((item) => item.factId),
    ["scalar", "list", "object", "mixed"],
  );
  assert.equal(parsed.facts[2]?.value, '{"markets":["LV","LT"]}');
  assert.equal(parsed.facts[3]?.value, '["LV",{"country":"LT"}]');
});

test("buyer-logic normalization bounds an overlong procurement pattern", () => {
  const raw = JSON.stringify({
    offeringBuyerLogic: [
      {
        offeringKey: "coffee-studio-solutions",
        whyBuy: ["Improve the customer experience"],
        requiredConditions: [],
        preferredConditions: [],
        likelyTriggers: [],
        incompatibleConditions: [],
        likelyDecisionRoles: [],
        procurementPattern: `A considered purchase involving ${"operational review ".repeat(30)}`,
        positiveEvidenceSignals: [],
        negativeEvidenceSignals: [],
        evidenceIds: [],
        confidence: 0.7,
      },
    ],
    archetypes: [],
    proposedOfferingRules: [],
    unresolvedQuestions: [],
  });
  const normalized = JSON.parse(
    normalizeProfileStageProviderOutput("profile.buyer_logic", raw),
  );
  const parsed = profileBuyerLogicShardOutputSchema.parse(normalized);
  assert.ok(parsed.offeringBuyerLogic[0]!.procurementPattern!.length <= 320);
  assert.match(parsed.offeringBuyerLogic[0]!.procurementPattern!, /…$/);
});

test("normalization does not alter unrelated profile tasks", () => {
  const raw = '{"value":{"nested":true}}';
  assert.equal(normalizeProfileStageProviderOutput("profile.clarification", raw), raw);
});

function fact(factId: string, value: unknown) {
  return {
    factId,
    factFamily: "commercial",
    fieldHint: "test",
    subject: "Company",
    predicate: "has value",
    value,
    epistemicStatus: "explicit_fact",
    confidence: 0.8,
    evidenceIds: ["evidence-1"],
  };
}
