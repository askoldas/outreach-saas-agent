import assert from "node:assert/strict";
import test from "node:test";
import {
  profileBuyerLogicShardOutputSchema,
  profileV3TaskDefinitions,
} from "./task-contracts.ts";

test("buyer logic reserves enough output budget while using minimal reasoning", () => {
  const definition = profileV3TaskDefinitions.find(
    (candidate) => candidate.taskId === "profile.buyer_logic",
  );

  assert.ok(definition);
  assert.equal(definition.maxCompletionTokens, 6_000);
  assert.equal(definition.reasoningClass, "minimal");
  assert.equal(definition.schemaVersion, "profile-buyer-logic-schema-v7-compact-sharded");
  assert.match(definition.promptVersion, /-v8$/);
});

test("buyer logic shard rejects output that grows beyond the compact contract", () => {
  const base = buyerOutput();
  assert.doesNotThrow(() => profileBuyerLogicShardOutputSchema.parse(base));

  assert.throws(() =>
    profileBuyerLogicShardOutputSchema.parse({
      ...base,
      offeringBuyerLogic: [
        {
          ...base.offeringBuyerLogic[0],
          whyBuy: ["one", "two", "three", "four", "five"],
        },
      ],
    }),
  );

  assert.throws(() =>
    profileBuyerLogicShardOutputSchema.parse({
      ...base,
      archetypes: [archetype("one"), archetype("two"), archetype("three")],
    }),
  );

  assert.throws(() =>
    profileBuyerLogicShardOutputSchema.parse({
      ...base,
      proposedOfferingRules: [rule("one"), rule("two")],
    }),
  );
});

function buyerOutput() {
  return {
    offeringBuyerLogic: [
      {
        offeringKey: "offering-one",
        whyBuy: ["Solve a high-value customer problem"],
        requiredConditions: [],
        preferredConditions: [],
        likelyTriggers: [],
        incompatibleConditions: [],
        likelyDecisionRoles: [],
        positiveEvidenceSignals: [],
        negativeEvidenceSignals: [],
        evidenceIds: [],
        confidence: 0.8,
      },
    ],
    archetypes: [],
    proposedOfferingRules: [],
    unresolvedQuestions: [],
  };
}

function archetype(suffix: string) {
  return {
    archetypeKey: `archetype-${suffix}`,
    offeringKey: "offering-one",
    name: `Archetype ${suffix}`,
    relationshipType: "direct buyer",
    priority: "priority" as const,
    description: "A compact buyer archetype.",
    whyCompatible: [],
    requiredEvidence: [],
    positiveSignals: [],
    negativeSignals: [],
    likelyDecisionRoles: [],
    evidenceIds: [],
    epistemicStatus: "hypothesis" as const,
    confidence: 0.6,
  };
}

function rule(suffix: string) {
  return {
    ruleKey: `rule-${suffix}`,
    label: `Rule ${suffix}`,
    description: "A material qualification rule.",
    ruleType: "positive_signal" as const,
    scope: "offering" as const,
    strength: "soft" as const,
    applicability: {
      objectives: [],
      offeringIds: ["offering-one"],
      geographies: [],
      relationshipTypes: [],
      archetypeIds: [],
    },
    status: "proposed" as const,
    source: "ai" as const,
    evidenceIds: [],
    confidence: 0.7,
  };
}
