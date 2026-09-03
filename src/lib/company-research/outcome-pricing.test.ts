import assert from "node:assert/strict";
import test from "node:test";
import {
  assessCampaignComplexity,
  quoteCompanyResearch,
  settleCompanyResearchOutcome,
} from "./outcome-pricing.ts";

test("quantity produces a versioned centralized maximum authorization", () => {
  assert.deepEqual(
    quoteCompanyResearch({
      requestedCompanyCount: 25,
      countryCount: 1,
      targetSignalCount: 4,
    }),
    {
      schemaVersion: 1,
      requestedCompanyCount: 25,
      complexity: "low",
      authorizedCredits: 80,
      recommendedCompanyCount: 25,
      pricingBasis: "requested_qualified_companies",
    },
  );
});

test("a target revision preserves the frozen pricing complexity", () => {
  const original = quoteCompanyResearch({
    requestedCompanyCount: 25,
    complexity: "high",
  });
  const revised = quoteCompanyResearch({ requestedCompanyCount: 50, complexity: "high" });
  assert.equal(original.complexity, revised.complexity);
  assert.equal(revised.authorizedCredits - original.authorizedCredits, 95);
});

test("complexity remains lightweight deterministic and provider-neutral", () => {
  assert.equal(
    assessCampaignComplexity({ countryCount: 1, targetSignalCount: 4 }),
    "low",
  );
  assert.equal(
    assessCampaignComplexity({ countryCount: 5, targetSignalCount: 4 }),
    "medium",
  );
  assert.equal(
    assessCampaignComplexity({ broadMarket: true, targetSignalCount: 4 }),
    "high",
  );
});

test("market exhaustion bounds actual work by delivered outcome value", () => {
  const settlement = settleCompanyResearchOutcome({
    authorizedCredits: 20,
    accruedCredits: 20,
    previouslyChargedCredits: 20,
    requestedCompanyCount: 25,
    deliveredCompanyCount: 10,
    completionReason: "market_exhausted",
  });
  assert.equal(settlement.finalChargedCredits, 10.4);
  assert.equal(settlement.releasedAuthorizationCredits, 9.6);
  assert.equal(settlement.refundableCredits, 9.6);
});

test("target delivery charges no more than accrued work or quote", () => {
  assert.equal(
    settleCompanyResearchOutcome({
      authorizedCredits: 20,
      accruedCredits: 13,
      requestedCompanyCount: 25,
      deliveredCompanyCount: 25,
      completionReason: "target_reached",
    }).finalChargedCredits,
    13,
  );
});

test("user stop pays for actual work while genuine technical failure is not charged", () => {
  assert.equal(
    settleCompanyResearchOutcome({
      authorizedCredits: 20,
      accruedCredits: 8,
      requestedCompanyCount: 25,
      deliveredCompanyCount: 3,
      completionReason: "user_stopped",
    }).finalChargedCredits,
    8,
  );
  assert.equal(
    settleCompanyResearchOutcome({
      authorizedCredits: 20,
      accruedCredits: 8,
      requestedCompanyCount: 25,
      deliveredCompanyCount: 0,
      completionReason: "technical_failure",
    }).finalChargedCredits,
    0,
  );
});
