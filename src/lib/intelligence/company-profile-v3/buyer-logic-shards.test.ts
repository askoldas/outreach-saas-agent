import assert from "node:assert/strict";
import test from "node:test";
import {
  buyerLogicShardContexts,
  mergeBuyerLogicShardOutputs,
} from "./buyer-logic-shards.ts";

test("buyer logic creates one compact context per completed offering", () => {
  const shards = buyerLogicShardContexts({
    profileDraftId: "draft-1",
    previousStageOutputs: [
      { taskId: "profile.fact_extraction", output: { facts: ["large"] } },
      { taskId: "profile.commercial_synthesis", output: { summary: "commercial" } },
      {
        taskId: "profile.offering_decomposition",
        outputHash: "offerings-hash",
        output: {
          offerings: [offering("one"), offering("two")],
          ungroupedItems: [],
          groupingWarnings: [],
        },
      },
    ],
  });

  assert.deepEqual(
    shards.map((shard) => shard.offeringKey),
    ["one", "two"],
  );
  for (const shard of shards) {
    const previous = shard.context.previousStageOutputs;
    assert.equal(previous.length, 2);
    assert.equal(
      previous.some((stage) => stage.taskId === "profile.fact_extraction"),
      false,
    );
    const decomposition = previous.find(
      (stage) => stage.taskId === "profile.offering_decomposition",
    );
    assert.deepEqual(
      (
        decomposition?.output as { offerings: Array<{ offeringKey: string }> }
      ).offerings.map((item) => item.offeringKey),
      [shard.offeringKey],
    );
  }
});

test("buyer logic merges exact offering shards and rejects cross-offering output", () => {
  const merged = mergeBuyerLogicShardOutputs([
    { offeringKey: "one", output: buyerOutput("one") },
    { offeringKey: "two", output: buyerOutput("two") },
  ]);
  assert.deepEqual(
    merged.offeringBuyerLogic.map((logic) => logic.offeringKey),
    ["one", "two"],
  );
  assert.throws(
    () =>
      mergeBuyerLogicShardOutputs([{ offeringKey: "one", output: buyerOutput("two") }]),
    /outside offering one/,
  );
});

test("buyer logic deduplicates and caps merged unresolved questions", () => {
  const shards = Array.from({ length: 5 }, (_, index) => {
    const offeringKey = `offering-${index + 1}`;
    return {
      offeringKey,
      output: buyerOutput(offeringKey, [
        "Shared question",
        `Question ${index + 1}a`,
        `Question ${index + 1}b`,
      ]),
    };
  });

  const merged = mergeBuyerLogicShardOutputs(shards);

  assert.equal(merged.unresolvedQuestions.length, 11);
  assert.equal(merged.unresolvedQuestions[0], "Shared question");
  assert.equal(new Set(merged.unresolvedQuestions).size, 11);

  const capped = mergeBuyerLogicShardOutputs(
    Array.from({ length: 5 }, (_, index) => {
      const offeringKey = `unique-${index + 1}`;
      return {
        offeringKey,
        output: buyerOutput(offeringKey, [
          `Question ${index + 1}a`,
          `Question ${index + 1}b`,
          `Question ${index + 1}c`,
        ]),
      };
    }),
  );

  assert.equal(capped.unresolvedQuestions.length, 12);
  assert.equal(capped.unresolvedQuestions.at(-1), "Question 4c");
});

test("buyer logic deduplicates identical rules and offering-scopes conflicting keys", () => {
  const shared = rule("rule-baltic-geography-requirement", "Baltic presence required");
  const identical = mergeBuyerLogicShardOutputs([
    { offeringKey: "one", output: buyerOutput("one", [], shared) },
    { offeringKey: "two", output: buyerOutput("two", [], shared) },
  ]);
  assert.equal(identical.proposedOfferingRules.length, 1);

  const conflicting = mergeBuyerLogicShardOutputs([
    { offeringKey: "one", output: buyerOutput("one", [], shared) },
    {
      offeringKey: "two",
      output: buyerOutput(
        "two",
        [],
        rule("rule-baltic-geography-requirement", "Lithuanian presence required"),
      ),
    },
  ]);
  assert.deepEqual(
    conflicting.proposedOfferingRules.map(({ ruleKey, scope, applicability }) => ({
      ruleKey,
      scope,
      offeringIds: applicability.offeringIds,
    })),
    [
      {
        ruleKey: "rule-baltic-geography-requirement--one",
        scope: "offering",
        offeringIds: ["one"],
      },
      {
        ruleKey: "rule-baltic-geography-requirement--two",
        scope: "offering",
        offeringIds: ["two"],
      },
    ],
  );
});

function offering(offeringKey: string) {
  return {
    offeringKey,
    name: `Offering ${offeringKey}`,
    offeringType: "service",
    shortDescription: "A campaign-worthy offering.",
    includedItemKeys: [],
    excludedItemKeys: [],
    valueProposition: "Creates customer value.",
    customerProblems: ["A commercial problem"],
    expectedOutcomes: ["A commercial outcome"],
    customerConsumptionMode: "use",
    buyingMotion: "project",
    dependencies: [],
    commercialConstraints: [],
    evidenceIds: [],
    confidence: 0.8,
  };
}

function buyerOutput(
  offeringKey: string,
  unresolvedQuestions: string[] = [],
  proposedRule?: ReturnType<typeof rule>,
) {
  return {
    offeringBuyerLogic: [
      {
        offeringKey,
        whyBuy: ["Solve a defined problem"],
        requiredConditions: [],
        preferredConditions: [],
        likelyTriggers: [],
        incompatibleConditions: [],
        likelyDecisionRoles: [],
        positiveEvidenceSignals: [],
        negativeEvidenceSignals: [],
        evidenceIds: [],
        confidence: 0.7,
      },
    ],
    archetypes: [],
    proposedOfferingRules: proposedRule ? [proposedRule] : [],
    unresolvedQuestions,
  };
}

function rule(ruleKey: string, description: string) {
  return {
    ruleKey,
    label: "Geography requirement",
    description,
    ruleType: "requirement" as const,
    scope: "workspace" as const,
    strength: "soft" as const,
    applicability: {
      objectives: [],
      offeringIds: [],
      geographies: ["Baltics"],
      relationshipTypes: [],
      archetypeIds: [],
    },
    status: "proposed" as const,
    source: "ai" as const,
    evidenceIds: [],
    confidence: 0.7,
  };
}
