import assert from "node:assert/strict";
import test from "node:test";
import { createNativeCampaignStrategyFixture } from "../intelligence/campaign-strategy-v2/test-fixture.ts";
import {
  buildCandidateEvidenceExtractionMessages,
  normalizeCandidateEvidenceExtraction,
} from "./evidence-extraction.ts";
import { compileCandidateResearchPlan } from "./research-plan.ts";
import { prepareCampaignResearchPlans } from "./research-runtime.ts";

test("Campaign research plans freeze required policy questions and reusable state", () => {
  const strategy = confirmedStrategy();
  const [prepared] = prepareCampaignResearchPlans({
    campaignRunId: "run-1",
    strategyVersionId: strategy.id,
    strategy,
    candidates: [
      {
        campaignCandidateId: "candidate-1",
        organizationId: "organization-1",
        organizationName: "Example",
        organizationType: "operating_company",
        canonicalDomain: "example.com",
        canonicalUrl: "https://example.com/",
        procurementAutonomy: "unknown",
        matchedArchetypeIds: [strategy.archetypes[0]!.id],
        discoverySourceIds: ["source-2", "source-1", "source-1"],
        currentIntelligenceVersionId: "intelligence-1",
        unresolvedQuestionKeys: [],
        conflictKeys: [],
        claimStates: [
          {
            key: "business_model",
            epistemicStatus: "explicit_fact",
            freshnessState: "current",
            reusableStatus: "active",
            reusableScope: "organization",
          },
        ],
      },
    ],
  });
  assert.ok(prepared);
  assert.equal(
    prepared.plan.questions.some(({ key }) => key === "business_model"),
    false,
  );
  assert.equal(
    prepared.plan.questions.some(
      ({ key, required }) => key === "relationship-compatibility" && required,
    ),
    true,
  );
  assert.equal(
    prepared.plan.questions.some(({ key }) => key === "procurement_authority"),
    true,
  );
  const geographyQuestion = prepared.plan.questions.find(
    ({ key }) => key === "target_geography",
  );
  assert.equal(geographyQuestion?.required, true);
  assert.match(geographyQuestion?.question ?? "", /Lithuania \(LT\)/);
  assert.match(geographyQuestion?.question ?? "", /incidental mention/i);
  assert.deepEqual(prepared.sourcePlan.discoverySourceIds, ["source-1", "source-2"]);
  assert.equal(prepared.inputHash.length, 64);
  assert.equal(prepared.contentHash.length, 64);
  assert.equal(prepared.reusableIntelligenceVersionId, null);
});

test("Candidate research plans cap the frozen question set at twelve", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: Array.from({ length: 20 }, (_, index) => `question-${index}`),
  });
  assert.equal(plan.questions.length, 12);
  assert.ok(plan.questions.every(({ required }) => required));
});

test("Deferred reusable gaps retain organization scope", () => {
  const strategy = confirmedStrategy();
  const unresolvedQuestionKeys = Array.from(
    { length: 16 },
    (_, index) => `organization_gap_${index}`,
  );
  const [prepared] = prepareCampaignResearchPlans({
    campaignRunId: "run-1",
    strategyVersionId: strategy.id,
    strategy,
    candidates: [
      {
        campaignCandidateId: "candidate-1",
        organizationId: "organization-1",
        organizationName: "Example",
        organizationType: "operating_company",
        canonicalDomain: "example.com",
        canonicalUrl: "https://example.com/",
        procurementAutonomy: "local",
        matchedArchetypeIds: [strategy.archetypes[0]!.id],
        discoverySourceIds: [],
        currentIntelligenceVersionId: "intelligence-1",
        unresolvedQuestionKeys,
        conflictKeys: [],
        claimStates: [],
      },
    ],
  });
  assert.ok(prepared);
  assert.ok(prepared.sourcePlan.deferredReusableQuestionKeys.length > 0);
  assert.ok(
    prepared.sourcePlan.deferredReusableQuestionKeys.every((key) =>
      prepared.sourcePlan.deferredQuestionKeys.includes(key),
    ),
  );
  assert.ok(
    prepared.plan.questions
      .filter(({ key }) => unresolvedQuestionKeys.includes(key))
      .every(({ reusableScope }) => reusableScope === "organization"),
  );
});

test("Evidence extraction fills omitted findings with explicit unknowns", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model", "products_services"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [
        {
          questionKey: "business_model",
          fieldPath: "commercial.businessModel",
          statement: "The official page describes wholesale distribution.",
          value: "wholesale_distribution",
          directness: "direct",
          confidence: 0.92,
          evidenceIds: ["evidence-1"],
        },
      ],
      questionFindings: [
        {
          questionKey: "business_model",
          state: "answered_positive",
          claimKeys: ["business_model"],
          evidenceIds: ["evidence-1"],
          conciseAnswer: "The organization describes wholesale distribution.",
        },
      ],
      missingEvidence: [],
    },
    plan,
    evidence: [
      {
        evidenceId: "evidence-1",
        sourceUrl: "https://example.com/",
        pageKind: "home",
        retrievedAt: "2026-07-28T10:00:00.000Z",
        content: "Wholesale distribution.",
      },
    ],
  });
  assert.equal(extraction.questionFindings.length, 2);
  assert.equal(
    extraction.questionFindings.find(
      ({ questionKey }) => questionKey === "products_services",
    )?.state,
    "unknown",
  );
});

test("Evidence extraction bounds oversized model prose without failing research", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [],
      questionFindings: [
        {
          questionKey: "business_model",
          state: "unknown",
          claimKeys: [],
          evidenceIds: [],
          conciseAnswer: "A".repeat(700),
        },
      ],
      missingEvidence: ["B".repeat(450)],
    },
    plan,
    evidence: [],
  });

  assert.equal(extraction.questionFindings[0]?.conciseAnswer.length, 600);
  assert.equal(extraction.missingEvidence[0]?.length, 300);
});

test("Evidence extraction discards citations outside the frozen context", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [
        {
          questionKey: "business_model",
          fieldPath: "commercial.businessModel",
          statement: "Unsupported external statement.",
          value: "distribution",
          directness: "direct",
          confidence: 0.9,
          evidenceIds: ["foreign-evidence"],
        },
      ],
      questionFindings: [
        {
          questionKey: "business_model",
          state: "answered_positive",
          claimKeys: ["business_model"],
          evidenceIds: ["foreign-evidence"],
          conciseAnswer: "Unsupported external answer.",
        },
      ],
      missingEvidence: [],
    },
    plan,
    evidence: [],
  });

  assert.equal(extraction.claims.length, 0);
  assert.equal(extraction.questionFindings[0]?.state, "unknown");
  assert.deepEqual(extraction.questionFindings[0]?.evidenceIds, []);
  assert.match(extraction.missingEvidence[0] ?? "", /outside the supplied evidence/);
});

test("Evidence extraction discards question keys outside the frozen plan", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [
        {
          questionKey: "invented-requirement-5",
          fieldPath: "commercial.invented",
          statement: "Unsupported statement.",
          directness: "direct",
          confidence: 0.9,
          evidenceIds: ["evidence-1"],
        },
      ],
      questionFindings: [
        {
          questionKey: "invented-requirement-5",
          state: "answered_positive",
          claimKeys: [],
          evidenceIds: ["evidence-1"],
          conciseAnswer: "Unsupported answer.",
        },
      ],
      missingEvidence: [],
    },
    plan,
    evidence: [
      {
        evidenceId: "evidence-1",
        sourceUrl: "https://example.com/",
        pageKind: "home",
        retrievedAt: "2026-08-01T10:00:00.000Z",
        content: "Example evidence.",
      },
    ],
  });

  assert.equal(extraction.claims.length, 0);
  assert.deepEqual(
    extraction.questionFindings.map(({ questionKey, state }) => ({
      questionKey,
      state,
    })),
    [{ questionKey: "business_model", state: "unknown" }],
  );
  assert.match(extraction.missingEvidence[0] ?? "", /outside the frozen research plan/);
});

test("Evidence extraction retains competing claims for conflict resolution", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [
        {
          questionKey: "business_model",
          fieldPath: "commercial.businessModel",
          statement: "The first source describes direct distribution.",
          value: "direct_distribution",
          directness: "direct",
          confidence: 0.9,
          evidenceIds: ["evidence-1"],
        },
        {
          questionKey: "business_model",
          fieldPath: "commercial.businessModel",
          statement: "The second source describes wholesale distribution.",
          value: "wholesale_distribution",
          directness: "reported",
          confidence: 0.7,
          evidenceIds: ["evidence-2"],
        },
      ],
      questionFindings: [
        {
          questionKey: "business_model",
          state: "conflicting",
          claimKeys: ["business_model"],
          evidenceIds: ["evidence-1", "evidence-2"],
          conciseAnswer: "The supplied sources describe different operating models.",
        },
      ],
      missingEvidence: ["A current official business-model statement is needed."],
    },
    plan,
    evidence: [
      {
        evidenceId: "evidence-1",
        sourceUrl: "https://example.com/",
        pageKind: "home",
        retrievedAt: "2026-07-28T10:00:00.000Z",
        content: "Direct distribution.",
      },
      {
        evidenceId: "evidence-2",
        sourceUrl: "https://directory.example/record",
        pageKind: "other",
        retrievedAt: "2026-07-28T10:00:00.000Z",
        content: "Wholesale distribution.",
      },
    ],
  });
  assert.equal(extraction.claims.length, 2);
  assert.equal(extraction.questionFindings[0]?.state, "conflicting");
});

test("Evidence extraction derives finding links from frozen question keys", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model", "products_services"],
  });
  const extraction = normalizeCandidateEvidenceExtraction({
    raw: {
      claims: [
        {
          questionKey: "business_model",
          fieldPath: "commercial.businessModel",
          statement: "The official page describes wholesale distribution.",
          value: "wholesale_distribution",
          directness: "direct",
          confidence: 0.92,
          evidenceIds: ["evidence-1"],
        },
      ],
      questionFindings: [
        {
          questionKey: "business_model",
          state: "answered_positive",
          claimKeys: ["The organization is a wholesale distributor", "BUSINESS MODEL"],
          evidenceIds: ["evidence-1"],
          conciseAnswer: "The organization describes wholesale distribution.",
        },
        {
          questionKey: "products_services",
          state: "unknown",
          claimKeys: ["unsupported free-form claim"],
          evidenceIds: [],
          conciseAnswer: "The supplied page does not resolve the product range.",
        },
      ],
      missingEvidence: [],
    },
    plan,
    evidence: [
      {
        evidenceId: "evidence-1",
        sourceUrl: "https://example.com/",
        pageKind: "home",
        retrievedAt: "2026-07-28T10:00:00.000Z",
        content: "Wholesale distribution.",
      },
    ],
  });
  assert.deepEqual(
    extraction.questionFindings.map(({ questionKey, claimKeys }) => ({
      questionKey,
      claimKeys,
    })),
    [
      { questionKey: "business_model", claimKeys: ["business_model"] },
      { questionKey: "products_services", claimKeys: [] },
    ],
  );
});

test("Candidate evidence prompts keep scoring and eligibility outside research", () => {
  const plan = compileCandidateResearchPlan({
    organizationId: "organization-1",
    campaignCandidateId: "candidate-1",
    strategyVersionId: "strategy-1",
    requiredQuestionKeys: ["business_model"],
  });
  const prompt = JSON.stringify(
    buildCandidateEvidenceExtractionMessages({
      organization: {
        id: "organization-1",
        name: "Example",
        organizationType: "operating_company",
        canonicalDomain: "example.com",
      },
      campaign: {
        objective: {},
        matchedArchetypes: [],
        qualificationFactors: [],
        hardExclusionRules: [],
      },
      plan,
      evidence: [],
    }),
  );
  assert.match(prompt, /Do not assign relationship, eligibility, fit, potential/);
  assert.match(prompt, /untrusted data/);
  assert.match(prompt, /Copy evidence IDs exactly/);
  assert.match(prompt, /Copy questionKey values exactly/);
  assert.match(prompt, /Set questionFindings\.claimKeys to an empty array/);
});

function confirmedStrategy() {
  const strategy = createNativeCampaignStrategyFixture();
  strategy.status = "confirmed";
  strategy.objective.userConfirmed = true;
  strategy.geography.userConfirmed = true;
  strategy.userConfirmation = {
    confirmed: true,
    confirmedByUserId: "user-1",
    confirmedAt: "2026-07-28T09:00:00.000Z",
  };
  return strategy;
}
