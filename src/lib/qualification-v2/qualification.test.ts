import assert from "node:assert/strict";
import test from "node:test";
import { decideEligibility, assignReviewLane } from "./decision.ts";
import { compileFactorLibrary } from "./factor-library.ts";
import { classifyRelationship } from "./relationship.ts";
import { calculateConfidence, calculateFit, calculatePotential } from "./scoring.ts";

const factors = compileFactorLibrary([
  "business_model_compatibility",
  "offering_use_compatibility",
  "account_scale",
]);

test("unknown factors are excluded from the score denominator", () => {
  const fit = calculateFit(factors, [
    {
      factorKey: "business_model_compatibility",
      applicability: "applicable",
      state: "positive",
      signedValue: 1,
      confidence: 0.9,
      evidenceQuality: 0.9,
      evidenceIds: [],
      counterEvidenceIds: [],
    },
    {
      factorKey: "offering_use_compatibility",
      applicability: "applicable",
      state: "unknown",
      confidence: 0,
      evidenceQuality: 0,
      evidenceIds: [],
      counterEvidenceIds: [],
    },
  ]);
  assert.equal(fit.score, 100);
  assert.deepEqual(fit.excludedFactorKeys, ["offering_use_compatibility"]);
});

test("empty fit and potential denominators return null", () => {
  assert.equal(calculateFit(factors, []).score, null);
  assert.equal(calculatePotential(factors, []).score, null);
});

test("hard exclusions and invalid identity precede fit", () => {
  const common = {
    merged: false,
    relationship: "probable_buyer" as const,
    relationshipConfidence: 0.9,
    desiredRelationships: ["probable_buyer" as const],
    factorEvaluations: [],
    evidenceCoverage: 1,
    minimumEvidenceCoverage: 0.5,
    fitScore: 99,
    rejectBelowFit: 40,
    limitingCondition: false,
  };
  assert.equal(
    decideEligibility({ ...common, validEntity: false, exclusions: [] }),
    "invalid_entity",
  );
  assert.equal(
    decideEligibility({
      ...common,
      validEntity: true,
      exclusions: [
        {
          ruleId: "blocked",
          strength: "hard",
          state: "triggered",
          confidence: 1,
          evidenceIds: ["e1"],
          effect: "exclude",
        },
      ],
    }),
    "excluded",
  );
});

test("unknown relationship requires research", () => {
  const relationship = classifyRelationship({
    desiredRelationships: ["probable_buyer"],
    observations: [],
  });
  assert.equal(relationship.primaryRelationship, "unknown");
  assert.equal(relationship.decisionBasis, "insufficient_evidence");
});

test("confidence caps unresolved critical dimensions", () => {
  const confidence = calculateConfidence({
    definitions: factors,
    evaluations: [],
    identityConfidence: 1,
    relationshipConfidence: 0.4,
    procurementConfidence: 0,
    procurementCritical: true,
    unresolvedIdentity: false,
    suspectedHardExclusion: false,
  });
  assert.equal(confidence.score <= 55, true);
  assert.equal(confidence.caps.includes("unresolved_procurement"), true);
});

test("potential cannot place an ineligible candidate in recommended", () => {
  assert.equal(
    assignReviewLane({
      eligibility: "excluded",
      fitScore: 100,
      confidence: 100,
      minimumFitForRecommended: 80,
      minimumFitForConditional: 60,
      minimumConfidenceForRecommended: 75,
    }),
    "excluded",
  );
});
