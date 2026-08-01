import assert from "node:assert/strict";
import test from "node:test";
import { profileBuyerLogicOutputSchema } from "./task-contracts.ts";
import { normalizeLegacyProfileBuyerRuleScopes } from "./profile-rule-scopes.ts";

test("legacy AI candidate rules are remapped to a matching offering scope", () => {
  const normalized = normalizeLegacyProfileBuyerRuleScopes(
    buyerLogicWithRule({
      scope: "candidate",
      applicability: {
        objectives: [],
        offeringIds: ["core-products"],
        geographies: [],
        relationshipTypes: [],
        archetypeIds: [],
      },
    }),
    new Set(["core-products"]),
  );

  const parsed = profileBuyerLogicOutputSchema.parse(normalized);
  assert.equal(parsed.proposedOfferingRules[0]?.scope, "offering");
});

test("legacy AI candidate rules without one matching offering remain proposed at workspace scope", () => {
  const normalized = normalizeLegacyProfileBuyerRuleScopes(
    buyerLogicWithRule({
      scope: "candidate",
      applicability: {
        objectives: [],
        offeringIds: [],
        geographies: [],
        relationshipTypes: ["direct_buyer"],
        archetypeIds: [],
      },
    }),
    new Set(["core-products"]),
  );

  const parsed = profileBuyerLogicOutputSchema.parse(normalized);
  assert.equal(parsed.proposedOfferingRules[0]?.scope, "workspace");
  assert.deepEqual(
    parsed.proposedOfferingRules[0]?.applicability.relationshipTypes,
    ["direct_buyer"],
  );
});

test("non-AI invalid scopes are not silently promoted into profile rules", () => {
  const normalized = normalizeLegacyProfileBuyerRuleScopes(
    buyerLogicWithRule({ scope: "candidate", source: "user", status: "confirmed" }),
    new Set(["core-products"]),
  );

  assert.throws(() => profileBuyerLogicOutputSchema.parse(normalized));
});

function buyerLogicWithRule(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    purchaseLogic: {
      whyBuy: [],
      requiredConditions: [],
      preferredConditions: [],
      likelyTriggers: [],
      incompatibleConditions: [],
    },
    archetypes: [],
    proposedOfferingRules: [
      {
        ruleKey: "soft_exclude_remote_only_customers",
        label: "Remote-only customers",
        description: "Remote-only customers are a weaker fit.",
        ruleType: "soft_exclusion",
        scope: "candidate",
        strength: "soft",
        applicability: {
          objectives: [],
          offeringIds: [],
          geographies: [],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "proposed",
        source: "ai",
        evidenceIds: [],
        confidence: 0.6,
        ...overrides,
      },
    ],
    unresolvedQuestions: [],
  };
}
