import assert from "node:assert/strict";
import test from "node:test";
import {
  compileQualificationRubric,
  normalizeFactorEvaluations,
  normalizeRelationshipClassification,
  type QualificationClaim,
  type QualificationEvidence,
  type RuntimeQualificationFactor,
} from "./runtime.ts";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";

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

test("qualification injects a target-market eligibility gate for older frozen strategies", () => {
  const strategy = createNativeCampaignStrategyFixture();
  strategy.qualificationPolicy.factorDefinitions =
    strategy.qualificationPolicy.factorDefinitions.filter(
      ({ factorKey }) => factorKey !== "target_geography",
    );
  const rubric = compileQualificationRubric(strategy);
  const geography = rubric.factors.find(({ key }) => key === "target_geography");
  assert.deepEqual(geography?.purposes, ["eligibility"]);
  assert.equal(geography?.criticality, "required");
  assert.match(geography?.definition ?? "", /Lithuania/);
  assert.match(geography?.definition ?? "", /incidental mentions/i);
});

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

test("unsupported observed factors downgrade to unknown", () => {
  const result = normalizeFactorEvaluations({
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
  });
  assert.equal(result.output.factors[0]?.state, "unknown");
  assert.equal(result.output.factors[0]?.strength, 0);
  assert.equal(result.output.factors[0]?.confidence, 0);
  assert.equal(result.output.factors[0]?.criticalGateRecommendation, "unresolved");
  assert.equal(result.evaluations[0]?.state, "unknown");
  assert.equal(result.evaluations[0]?.criticalGateState, "unresolved");
  assert.equal(result.evaluations[0]?.signedValue, undefined);
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
