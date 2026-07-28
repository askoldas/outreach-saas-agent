import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeFactorEvaluations,
  normalizeRelationshipClassification,
  type QualificationClaim,
  type QualificationEvidence,
  type RuntimeQualificationFactor,
} from "./runtime.ts";

const claims: QualificationClaim[] = [
  {
    id: "claim-buyer",
    key: "commercial_relationship",
    statement: "The organization procures the relevant category.",
    value: true,
    epistemicStatus: "explicit_fact",
    confidence: 0.9,
    evidenceIds: ["evidence-home"],
  },
];

const evidence: QualificationEvidence[] = [
  {
    id: "evidence-home",
    evidenceType: "official_web_page",
    excerpt: "Procurement information",
    directness: "direct",
    sourceReliability: "first_party",
    freshnessState: "current",
  },
];

const factors: RuntimeQualificationFactor[] = [
  {
    key: "offering_use_compatibility",
    label: "Offering-use compatibility",
    definition: "The organization can use the offering.",
    purposes: ["fit", "eligibility"],
    weight: 100,
    criticality: "required",
    unknownPolicy: "requires_research_if_required",
    positiveDefinition: "Direct use is supported.",
    negativeDefinition: "Use is incompatible.",
    acceptedEvidenceTypes: ["official_web_page"],
  },
];

test("relationship classification cannot cite claims outside the frozen context", () => {
  assert.throws(
    () =>
      normalizeRelationshipClassification({
        raw: {
          primaryRelationship: "probable_buyer",
          secondaryRelationships: [],
          objectiveCompatibility: "compatible",
          confidence: 0.9,
          positiveClaimIds: ["foreign-claim"],
          negativeClaimIds: [],
          conflictClaimIds: [],
          missingEvidence: [],
          conciseRationale: "The evidence supports a buying relationship.",
        },
        claims,
        evidence,
      }),
    /outside its frozen context/,
  );
});

test("non-unknown relationships require a cited recorded claim", () => {
  assert.throws(
    () =>
      normalizeRelationshipClassification({
        raw: {
          primaryRelationship: "probable_buyer",
          secondaryRelationships: [],
          objectiveCompatibility: "compatible",
          confidence: 0.9,
          positiveClaimIds: [],
          negativeClaimIds: [],
          conflictClaimIds: [],
          missingEvidence: [],
          conciseRationale: "Unsupported conclusion.",
        },
        claims,
        evidence,
      }),
    /requires at least one cited claim/,
  );
});

test("factor evaluation requires every frozen factor exactly once", () => {
  assert.throws(
    () =>
      normalizeFactorEvaluations({
        raw: { factors: [] },
        factors,
        claims,
        evidence,
      }),
    /every frozen factor exactly once/,
  );
});

test("observed factors require recorded claims and evidence", () => {
  assert.throws(
    () =>
      normalizeFactorEvaluations({
        raw: {
          factors: [
            {
              factorKey: "offering_use_compatibility",
              state: "positive",
              strength: 3,
              confidence: 0.9,
              supportingClaimIds: [],
              counterClaimIds: [],
              evidenceIds: [],
              missingEvidence: [],
              conciseExplanation: "Unsupported positive.",
              criticalGateRecommendation: "pass",
            },
          ],
        },
        factors,
        claims,
        evidence,
      }),
    /requires strength, claims, and evidence/,
  );
});

test("factor normalization derives bounded deterministic values and quality", () => {
  const result = normalizeFactorEvaluations({
    raw: {
      factors: [
        {
          factorKey: "offering_use_compatibility",
          state: "positive",
          strength: 3,
          confidence: 0.9,
          supportingClaimIds: ["claim-buyer"],
          counterClaimIds: [],
          evidenceIds: ["evidence-home"],
          missingEvidence: [],
          conciseExplanation: "The first-party evidence supports direct use.",
          criticalGateRecommendation: "pass",
        },
      ],
    },
    factors,
    claims,
    evidence,
  });
  assert.equal(result.evaluations[0]?.signedValue, 1);
  assert.equal(result.evaluations[0]?.potentialValue, 1);
  assert.equal(result.evaluations[0]?.evidenceQuality, 1);
  assert.equal(result.evaluations[0]?.criticalGateState, "passed");
});
