import assert from "node:assert/strict";
import test from "node:test";
import {
  compileQualificationRubric,
  compileHardExclusions,
  isVerifiableClaim,
  mapCampaignRelationshipsToQualification,
  normalizeFactorEvaluations,
  normalizeRelationshipClassification,
  prepareQualificationCandidates,
  qualificationClaimFactorKeys,
  qualificationFactorTaskDefinition,
  qualificationRelationshipTaskDefinition,
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
    applicability: {
      organizationId: "organization-1",
      campaignId: "campaign-1",
      offeringIds: ["offering-1"],
      archetypeIds: ["archetype-1"],
      questionKeys: ["commercial_relationship"],
      relationship: true,
      factorKeys: ["offering_use_compatibility"],
      exclusionRuleKeys: [],
    },
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

test("qualification always includes evidence-backed commercial ranking dimensions", () => {
  const rubric = compileQualificationRubric(createNativeCampaignStrategyFixture());
  assert.deepEqual(
    rubric.factors
      .filter(({ key }) =>
        ["account_scale", "geographic_reach", "trigger_strength"].includes(key),
      )
      .map(({ key }) => key)
      .sort(),
    ["account_scale", "geographic_reach", "trigger_strength"],
  );
  assert.equal(
    rubric.factors
      .filter(({ key }) =>
        ["account_scale", "geographic_reach", "trigger_strength"].includes(key),
      )
      .every(({ purposes }) => purposes.includes("commercial_potential")),
    true,
  );
});

test("generic commercial research claims bind to ranking factors", () => {
  const keys = ["account_scale", "geographic_reach", "trigger_strength"];
  assert.deepEqual(qualificationClaimFactorKeys("commercial_scale", keys), [
    "account_scale",
    "geographic_reach",
  ]);
  assert.deepEqual(qualificationClaimFactorKeys("opportunity_timing", keys), [
    "trigger_strength",
  ]);
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

test("a cited hypothesis cannot establish a relationship", () => {
  const hypothesis: QualificationClaim = {
    ...claims[0]!,
    id: "claim-hypothesis",
    epistemicStatus: "hypothesis",
  };
  const result = normalizeRelationshipClassification({
    raw: {
      primaryRelationship: "probable_buyer",
      secondaryRelationships: [],
      objectiveCompatibility: "compatible",
      confidence: 0.9,
      positiveClaimIds: [hypothesis.id],
      negativeClaimIds: [],
      conflictClaimIds: [],
      missingEvidence: [],
      conciseRationale: "Hypothesis only.",
    },
    claims: [hypothesis],
    evidence,
  });

  assert.equal(result.assessment.primaryRelationship, "unknown");
  assert.equal(result.assessment.decisionBasis, "insufficient_evidence");
});

test("factor evidence must be linked to a verifiable supporting claim", () => {
  const unrelatedEvidence: QualificationEvidence = {
    ...evidence[0]!,
    id: "evidence-unrelated",
    excerpt: "Unrelated company history.",
  };
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
          evidenceIds: ["evidence-unrelated"],
          missingEvidence: [],
          conciseExplanation: "Cites unrelated evidence.",
          criticalGateRecommendation: "pass",
        },
      ],
    },
    factors,
    claims,
    evidence: [...evidence, unrelatedEvidence],
  });

  assert.equal(result.evaluations[0]?.state, "unknown");
  assert.equal(result.evaluations[0]?.criticalGateState, "unresolved");
});

test("verifiable claims require bounded usable evidence", () => {
  assert.equal(
    isVerifiableClaim(claims[0], new Map(evidence.map((item) => [item.id, item]))),
    true,
  );
  assert.equal(
    isVerifiableClaim(
      claims[0],
      new Map(
        evidence.map((item) => [
          item.id,
          { ...item, excerpt: null, directness: "unknown" as const },
        ]),
      ),
    ),
    false,
  );
});

test("Campaign relationship taxonomy has an explicit qualification boundary", () => {
  assert.deepEqual(
    mapCampaignRelationshipsToQualification([
      "direct_buyer",
      "end_user_customer",
      "implementation_partner",
      "supplier",
    ]),
    ["end_user", "integration_partner", "probable_buyer", "supplier"],
  );
});

test("a changed cited-claim snapshot invalidates the qualification input hash", () => {
  const rubric = compileQualificationRubric(createNativeCampaignStrategyFixture());
  const candidate = {
    campaignCandidateId: "candidate-1",
    organizationId: "organization-1",
    candidateIntelligenceVersionId: "intelligence-1",
    intelligenceContentHash: "a".repeat(64),
    state: "active",
    identityConfidence: 0.9,
    identityReviewState: "resolved",
    operatingStatus: "active",
    mergedIntoOrganizationId: null,
    procurementAutonomy: "independent",
    procurementConfidence: 0.8,
  };
  const first = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [candidate],
  });
  const changed = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [{ ...candidate, intelligenceContentHash: "b".repeat(64) }],
  });

  assert.notEqual(first[0]?.inputHash, changed[0]?.inputHash);
});

test("an exact Company Intelligence version invalidates qualification independently", () => {
  const rubric = compileQualificationRubric(createNativeCampaignStrategyFixture());
  const candidate = {
    campaignCandidateId: "candidate-1",
    organizationId: "organization-1",
    candidateIntelligenceVersionId: "legacy-intelligence-1",
    companyIntelligenceVersionId: "company-intelligence-1",
    companyIntelligenceContentHash: "c".repeat(64),
    intelligenceContentHash: "a".repeat(64),
    state: "active",
    identityConfidence: 0.9,
    identityReviewState: "resolved",
    operatingStatus: "active",
    mergedIntoOrganizationId: null,
    procurementAutonomy: "independent",
    procurementConfidence: 0.8,
  };
  const first = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [candidate],
  });
  const changed = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [
      {
        ...candidate,
        companyIntelligenceVersionId: "company-intelligence-2",
        companyIntelligenceContentHash: "d".repeat(64),
      },
    ],
  });

  assert.equal(first[0]?.companyIntelligenceVersionId, "company-intelligence-1");
  assert.notEqual(first[0]?.inputHash, changed[0]?.inputHash);
});

test("an exact Commercial Relationship assessment invalidates qualification independently", () => {
  const rubric = compileQualificationRubric(createNativeCampaignStrategyFixture());
  const candidate = {
    campaignCandidateId: "candidate-1",
    organizationId: "organization-1",
    candidateIntelligenceVersionId: "legacy-intelligence-1",
    commercialRelationshipAssessmentVersionId: "relationship-1",
    commercialRelationshipAssessmentContentHash: "e".repeat(64),
    intelligenceContentHash: "a".repeat(64),
    state: "active",
    identityConfidence: 0.9,
    identityReviewState: "resolved",
    operatingStatus: "active",
    mergedIntoOrganizationId: null,
    procurementAutonomy: "independent",
    procurementConfidence: 0.8,
  };
  const first = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [candidate],
  });
  const changed = prepareQualificationCandidates({
    campaignRunId: "run-1",
    rubric,
    candidates: [
      {
        ...candidate,
        commercialRelationshipAssessmentVersionId: "relationship-2",
      },
    ],
  });
  assert.equal(first[0]?.commercialRelationshipAssessmentVersionId, "relationship-1");
  assert.notEqual(first[0]?.inputHash, changed[0]?.inputHash);
});

test("hard exclusion requires an applicable verifiable positive claim", () => {
  const exclusionClaim: QualificationClaim = {
    ...claims[0]!,
    id: "claim-exclusion",
    key: "exclusion.blocked",
    applicability: {
      ...claims[0]!.applicability,
      questionKeys: ["exclusion.blocked"],
      exclusionRuleKeys: ["blocked"],
    },
  };
  const rule = {
    ruleKey: "blocked",
    label: "Blocked condition",
    description: "Exclude when explicitly present.",
    ruleType: "hard_exclusion" as const,
    scope: "campaign" as const,
    strength: "hard" as const,
    applicability: {
      objectives: [],
      offeringIds: [],
      geographies: [],
      relationshipTypes: [],
      archetypeIds: [],
    },
    status: "confirmed" as const,
    source: "user" as const,
    evidenceIds: [],
    confidence: 1,
  };
  const evaluate = (claim: QualificationClaim) =>
    compileHardExclusions({
      rules: [rule],
      claims: [claim],
      evidence,
      questionFindings: [
        {
          questionKey: "exclusion.blocked",
          state: "answered_positive",
          claimIds: [claim.id],
          conciseAnswer: "The condition is present.",
        },
      ],
    })[0];

  assert.equal(evaluate(exclusionClaim)?.state, "triggered");
  assert.equal(
    evaluate({ ...exclusionClaim, epistemicStatus: "hypothesis" })?.state,
    "unknown",
  );
});

test("relationship and factor evaluation are independent shared-runtime tasks", () => {
  assert.equal(
    qualificationRelationshipTaskDefinition.taskId,
    "candidate.relationship_classification",
  );
  assert.equal(qualificationFactorTaskDefinition.taskId, "candidate.factor_evaluation");
  assert.equal(qualificationRelationshipTaskDefinition.maxCompletionTokens, 2_000);
  assert.equal(qualificationFactorTaskDefinition.maxCompletionTokens, 5_000);
  assert.equal(qualificationRelationshipTaskDefinition.allowsRepair, true);
  assert.equal(qualificationFactorTaskDefinition.allowsFallback, true);
});
