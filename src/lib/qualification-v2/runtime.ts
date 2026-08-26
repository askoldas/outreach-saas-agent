import { z } from "zod";
import { hashCanonical } from "../intelligence/campaign-strategy-v2/context-compiler.ts";
import type { CampaignStrategyV2 } from "../intelligence/campaign-strategy-v2/schemas.ts";
import type { CommercialRelationshipAssessment } from "../intelligence/core/commercial-relationships.ts";
import type { IntelligenceRule } from "../intelligence/contracts/rules.ts";
import type { PromptDefinition } from "../intelligence/runtime/task-registry.ts";
import type {
  CandidateRelationship,
  ExclusionAssessment,
  FactorDefinition,
  FactorEvaluation,
  RelationshipAssessment,
} from "./contracts.ts";
import {
  STANDARD_FACTOR_LIBRARY,
  STANDARD_FACTOR_LIBRARY_VERSION,
} from "./factor-library.ts";

export const QUALIFICATION_RUNTIME_CONTRACT_VERSION =
  "candidate-qualification-v2.5-relationship-assessment";
export const QUALIFICATION_RELATIONSHIP_PROMPT_VERSION =
  "candidate-relationship-classification-v2.4-multidimensional";
export const QUALIFICATION_FACTOR_PROMPT_VERSION =
  "candidate-factor-evaluation-v2.3-shared-runtime";
export const QUALIFICATION_SCORING_POLICY_VERSION = "qualification-scoring-v2.2";
export const QUALIFICATION_CONFIDENCE_POLICY_VERSION = "qualification-confidence-v2.2";
export const QUALIFICATION_EXCLUSION_POLICY_VERSION =
  "qualification-exclusions-v2.2-positive-evidence";

const candidateRelationships = [
  "probable_buyer",
  "possible_buyer",
  "end_user",
  "reseller",
  "distributor",
  "channel_partner",
  "integration_partner",
  "referral_partner",
  "supplier",
  "competitor",
  "strategic_partner",
  "investor_or_acquirer",
  "existing_customer",
  "former_customer",
  "irrelevant_adjacent",
  "unknown",
] as const satisfies readonly CandidateRelationship[];

export const relationshipOutputSchema = z
  .object({
    primaryRelationship: z.enum(candidateRelationships),
    secondaryRelationships: z.array(z.enum(candidateRelationships)).max(6),
    objectiveCompatibility: z.enum([
      "compatible",
      "conditionally_compatible",
      "incompatible",
      "unknown",
    ]),
    confidence: z.number().min(0).max(1),
    positiveClaimIds: z.array(z.string().min(1)).max(20),
    negativeClaimIds: z.array(z.string().min(1)).max(20),
    conflictClaimIds: z.array(z.string().min(1)).max(20),
    missingEvidence: z.array(z.string().min(1).max(300)).max(12),
    conciseRationale: z.string().min(1).max(800),
  })
  .strict();

export const factorOutputSchema = z
  .object({
    factors: z
      .array(
        z
          .object({
            factorKey: z.string().min(1).max(180),
            state: z.enum([
              "positive",
              "negative",
              "unknown",
              "conflicting",
              "not_applicable",
            ]),
            strength: z.number().int().min(0).max(3),
            confidence: z.number().min(0).max(1),
            supportingClaimIds: z.array(z.string().min(1)).max(20),
            counterClaimIds: z.array(z.string().min(1)).max(20),
            evidenceIds: z.array(z.string().min(1)).max(20),
            missingEvidence: z.array(z.string().min(1).max(300)).max(12),
            conciseExplanation: z.string().min(1).max(800),
            criticalGateRecommendation: z.enum([
              "pass",
              "fail",
              "unresolved",
              "not_applicable",
            ]),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type QualificationClaim = {
  id: string;
  key: string;
  statement: string;
  value: unknown;
  epistemicStatus:
    | "explicit_fact"
    | "evidence_backed_inference"
    | "hypothesis"
    | "unknown"
    | "conflict";
  confidence: number;
  evidenceIds: string[];
  applicability: {
    organizationId: string;
    campaignId: string;
    offeringIds: string[];
    archetypeIds: string[];
    questionKeys: string[];
    relationship: boolean;
    factorKeys: string[];
    exclusionRuleKeys: string[];
  };
};

export type QualificationEvidence = {
  id: string;
  evidenceType: string;
  excerpt: string | null;
  directness: "direct" | "indirect" | "reported" | "unknown";
  sourceReliability:
    | "first_party"
    | "authoritative_registry"
    | "trusted_directory"
    | "reputable_secondary"
    | "unverified_secondary";
  freshnessState: "current" | "recent" | "stale" | "unknown";
};

export type RuntimeQualificationFactor = FactorDefinition & {
  definition: string;
  positiveDefinition: string;
  negativeDefinition: string;
  acceptedEvidenceTypes: string[];
};

export type QualificationThresholds = {
  minimumEvidenceCoverage: number;
  minimumConfidenceForRecommended: number;
  minimumFitForRecommended: number;
  minimumFitForConditional: number;
  rejectBelowFit: number;
};

export type QualificationRubricRuntime = {
  campaignId: string;
  offeringIds: string[];
  archetypeIds: string[];
  desiredRelationships: CandidateRelationship[];
  normallyExcludedRelationships: CandidateRelationship[];
  factors: RuntimeQualificationFactor[];
  hardExclusionRules: IntelligenceRule[];
  thresholds: QualificationThresholds;
  factorLibraryVersion: string;
  scoringPolicyVersion: string;
  relationshipClassifierVersion: string;
  exclusionPolicyVersion: string;
  contentHash: string;
};

export type PreparedQualificationCandidate = {
  campaignCandidateId: string;
  organizationId: string;
  candidateIntelligenceVersionId: string;
  companyIntelligenceVersionId?: string;
  commercialRelationshipAssessmentVersionId?: string;
  inputHash: string;
  validEntity: boolean;
  merged: boolean;
  identityConfidence: number;
  procurementAutonomy: string | null;
  procurementConfidence: number;
  procurementCritical: boolean;
};

export type RelationshipClassificationOutput = z.infer<typeof relationshipOutputSchema>;
export type FactorEvaluationOutput = z.infer<typeof factorOutputSchema>;

export function compileQualificationRubric(
  strategy: CampaignStrategyV2,
): QualificationRubricRuntime {
  const standardByKey = new Map(
    STANDARD_FACTOR_LIBRARY.map((factor) => [factor.key, factor] as const),
  );
  const factors = strategy.qualificationPolicy.factorDefinitions.map((factor) => {
    const standard = standardByKey.get(factor.factorKey);
    return {
      key: factor.factorKey,
      label: factor.label,
      definition: factor.definition,
      purposes: standard
        ? [...standard.purposes]
        : (["fit"] as FactorDefinition["purposes"]),
      weight: factor.weight,
      criticality:
        factor.criticality === "critical" ? ("required" as const) : factor.criticality,
      unknownPolicy:
        factor.unknownPolicy === "confidence_only"
          ? ("reduce_confidence_only" as const)
          : factor.unknownPolicy === "gate_if_critical"
            ? ("requires_research_if_required" as const)
            : ("requires_research_if_required" as const),
      positiveDefinition: factor.positiveDefinition,
      negativeDefinition: factor.negativeDefinition,
      acceptedEvidenceTypes: [...factor.acceptedEvidenceTypes],
    };
  });
  if (
    !strategy.geography.countryCodes.includes("WORLDWIDE") &&
    !factors.some(({ key }) => key === "target_geography")
  ) {
    factors.push({
      key: "target_geography",
      label: `Presence in ${strategy.geography.displayName}`,
      definition:
        `The organization is legally based in or demonstrably operates in ${strategy.geography.displayName} ` +
        `(${strategy.geography.countryCodes.join(", ")}). Query targeting and incidental mentions do not establish eligibility.`,
      purposes: ["eligibility"],
      weight: 1,
      criticality: "required",
      unknownPolicy: "requires_research_if_required",
      positiveDefinition:
        "Reliable first-party, registry, or trusted-directory evidence establishes presence in the target market.",
      negativeDefinition:
        "Reliable evidence establishes that the organization has no legal or operating presence in the target market.",
      acceptedEvidenceTypes: [
        "company_website",
        "official_document",
        "legal_registry",
        "reliable_public_source",
      ],
    });
  }
  const recommendedFit =
    strategy.qualificationPolicy.qualificationThresholds.recommendedFit ?? 75;
  const minimumFitForConditional = Math.max(0, recommendedFit - 20);
  const thresholds = {
    minimumEvidenceCoverage:
      strategy.qualificationPolicy.qualificationThresholds.minimumEvidenceCoverage ?? 0.5,
    minimumConfidenceForRecommended:
      100 *
      (strategy.qualificationPolicy.qualificationThresholds.minimumConfidence ?? 0.7),
    minimumFitForRecommended: recommendedFit,
    minimumFitForConditional,
    rejectBelowFit: Math.max(0, minimumFitForConditional - 15),
  };
  const withoutHash = {
    campaignId: strategy.campaignId,
    offeringIds: uniqueSorted(
      strategy.offeringReferences.map(({ offeringId }) => offeringId),
    ),
    archetypeIds: uniqueSorted(strategy.archetypes.map(({ id }) => id)),
    desiredRelationships: mapCampaignRelationshipsToQualification(
      strategy.objective.targetRelationshipTypes,
    ),
    normallyExcludedRelationships: mapCampaignRelationshipsToQualification(
      strategy.objective.normallyExcludedRelationshipTypes,
    ),
    factors,
    hardExclusionRules: [...strategy.qualificationPolicy.hardExclusionRules].sort(
      (left, right) => left.ruleKey.localeCompare(right.ruleKey),
    ),
    thresholds,
    factorLibraryVersion: `${STANDARD_FACTOR_LIBRARY_VERSION}+campaign-specialization`,
    scoringPolicyVersion: QUALIFICATION_SCORING_POLICY_VERSION,
    relationshipClassifierVersion: QUALIFICATION_RELATIONSHIP_PROMPT_VERSION,
    exclusionPolicyVersion: QUALIFICATION_EXCLUSION_POLICY_VERSION,
  };
  return {
    ...withoutHash,
    contentHash: hashCanonical(withoutHash),
  };
}

export function prepareQualificationCandidates(input: {
  campaignRunId: string;
  rubric: QualificationRubricRuntime;
  candidates: Array<{
    campaignCandidateId: string;
    organizationId: string;
    candidateIntelligenceVersionId: string;
    companyIntelligenceVersionId?: string;
    companyIntelligenceContentHash?: string;
    commercialRelationshipAssessmentVersionId?: string;
    commercialRelationshipAssessmentContentHash?: string;
    intelligenceContentHash: string;
    state: string;
    identityConfidence: number;
    identityReviewState: string;
    operatingStatus: string;
    mergedIntoOrganizationId: string | null;
    procurementAutonomy: string | null;
    procurementConfidence: number | null;
  }>;
}): PreparedQualificationCandidate[] {
  return [...input.candidates]
    .sort((left, right) =>
      left.campaignCandidateId.localeCompare(right.campaignCandidateId),
    )
    .map((candidate) => {
      const merged =
        candidate.state === "merged" ||
        candidate.identityReviewState === "merged" ||
        candidate.mergedIntoOrganizationId !== null;
      const validEntity =
        candidate.state !== "invalid" &&
        !["inactive", "closed"].includes(candidate.operatingStatus);
      const procurementCritical = input.rubric.factors.some(
        (factor) =>
          factor.key === "procurement_compatibility" && factor.criticality === "required",
      );
      return {
        campaignCandidateId: candidate.campaignCandidateId,
        organizationId: candidate.organizationId,
        candidateIntelligenceVersionId: candidate.candidateIntelligenceVersionId,
        ...(candidate.companyIntelligenceVersionId
          ? { companyIntelligenceVersionId: candidate.companyIntelligenceVersionId }
          : {}),
        ...(candidate.commercialRelationshipAssessmentVersionId
          ? {
              commercialRelationshipAssessmentVersionId:
                candidate.commercialRelationshipAssessmentVersionId,
            }
          : {}),
        validEntity,
        merged,
        identityConfidence: candidate.identityConfidence,
        procurementAutonomy: candidate.procurementAutonomy,
        procurementConfidence:
          candidate.procurementConfidence ??
          (candidate.procurementAutonomy && candidate.procurementAutonomy !== "unknown"
            ? 0.7
            : 0),
        procurementCritical,
        inputHash: hashCanonical({
          campaignRunId: input.campaignRunId,
          campaignCandidateId: candidate.campaignCandidateId,
          candidateIntelligenceVersionId: candidate.candidateIntelligenceVersionId,
          intelligenceContentHash: candidate.intelligenceContentHash,
          companyIntelligenceVersionId: candidate.companyIntelligenceVersionId ?? null,
          companyIntelligenceContentHash:
            candidate.companyIntelligenceContentHash ?? null,
          commercialRelationshipAssessmentVersionId:
            candidate.commercialRelationshipAssessmentVersionId ?? null,
          commercialRelationshipAssessmentContentHash:
            candidate.commercialRelationshipAssessmentContentHash ?? null,
          rubricContentHash: input.rubric.contentHash,
          identityConfidence: candidate.identityConfidence,
          identityReviewState: candidate.identityReviewState,
          mergedIntoOrganizationId: candidate.mergedIntoOrganizationId,
          procurementAutonomy: candidate.procurementAutonomy,
          procurementConfidence: candidate.procurementConfidence,
          contractVersion: QUALIFICATION_RUNTIME_CONTRACT_VERSION,
        }),
      };
    });
}

export function normalizeRelationshipClassification(input: {
  raw: unknown;
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
}) {
  const output = relationshipOutputSchema.parse(input.raw);
  const claimIds = new Set(input.claims.map(({ id }) => id));
  assertKnownIds(
    [...output.positiveClaimIds, ...output.negativeClaimIds, ...output.conflictClaimIds],
    claimIds,
    "Relationship classification cited a claim outside its frozen context.",
  );
  if (
    output.primaryRelationship !== "unknown" &&
    output.positiveClaimIds.length === 0 &&
    output.negativeClaimIds.length === 0
  ) {
    throw new Error("A non-unknown relationship requires at least one cited claim.");
  }
  const claimsById = new Map(input.claims.map((claim) => [claim.id, claim] as const));
  const evidenceById = new Map(input.evidence.map((item) => [item.id, item] as const));
  const decisiveClaimIds = [...output.positiveClaimIds, ...output.negativeClaimIds];
  if (
    output.primaryRelationship !== "unknown" &&
    !decisiveClaimIds.some(
      (id) =>
        Boolean(claimsById.get(id)?.applicability.relationship) &&
        isVerifiableClaim(claimsById.get(id), evidenceById),
    )
  ) {
    const downgraded = {
      ...output,
      primaryRelationship: "unknown" as const,
      secondaryRelationships: [],
      objectiveCompatibility: "unknown" as const,
      confidence: 0,
      positiveClaimIds: [],
      negativeClaimIds: [],
      conflictClaimIds: uniqueSorted([...output.conflictClaimIds, ...decisiveClaimIds]),
      missingEvidence: uniqueSorted([
        ...output.missingEvidence,
        "The cited relationship claims lack verifiable current evidence.",
      ]),
      conciseRationale:
        "The cited claims do not provide verifiable evidence for a relationship.",
    };
    return normalizeRelationshipClassification({
      raw: downgraded,
      claims: input.claims,
      evidence: input.evidence,
    });
  }
  const evidenceIds = uniqueSorted(
    [...output.positiveClaimIds, ...output.negativeClaimIds].flatMap(
      (claimId) => claimsById.get(claimId)?.evidenceIds ?? [],
    ),
  );
  const counterEvidenceIds = uniqueSorted(
    output.conflictClaimIds.flatMap(
      (claimId) => claimsById.get(claimId)?.evidenceIds ?? [],
    ),
  );
  const allowedEvidenceIds = new Set(input.evidence.map(({ id }) => id));
  assertKnownIds(
    [...evidenceIds, ...counterEvidenceIds],
    allowedEvidenceIds,
    "Relationship classification resolved to evidence outside its frozen context.",
  );
  const direct = output.positiveClaimIds.some(
    (id) => claimsById.get(id)?.epistemicStatus === "explicit_fact",
  );
  const assessment: RelationshipAssessment = {
    primaryRelationship: output.primaryRelationship,
    secondaryRelationships: uniqueSorted(output.secondaryRelationships).filter(
      (relationship) => relationship !== output.primaryRelationship,
    ),
    confidence: output.confidence,
    evidenceIds,
    counterEvidenceIds,
    unresolvedQuestions: uniqueSorted(output.missingEvidence),
    decisionBasis:
      output.primaryRelationship === "unknown"
        ? "insufficient_evidence"
        : direct
          ? "direct_evidence"
          : output.confidence >= 0.8
            ? "strong_inference"
            : output.confidence >= 0.5
              ? "weak_inference"
              : "insufficient_evidence",
  };
  return { output, assessment };
}

export function normalizeFactorEvaluations(input: {
  raw: unknown;
  factors: RuntimeQualificationFactor[];
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
}) {
  const parsedOutput = factorOutputSchema.parse(input.raw);
  const expectedKeys = input.factors.map(({ key }) => key).sort();
  const actualKeys = parsedOutput.factors.map(({ factorKey }) => factorKey).sort();
  if (
    expectedKeys.length !== actualKeys.length ||
    expectedKeys.some((key, index) => key !== actualKeys[index])
  ) {
    throw new Error("Factor evaluation must return every frozen factor exactly once.");
  }
  const claimIds = new Set(input.claims.map(({ id }) => id));
  const evidenceIds = new Set(input.evidence.map(({ id }) => id));
  const evidenceById = new Map(
    input.evidence.map((evidence) => [evidence.id, evidence] as const),
  );
  const output = {
    factors: parsedOutput.factors.map((factor) => {
      const unsupportedObservation =
        ["positive", "negative"].includes(factor.state) &&
        (factor.strength === 0 ||
          factor.supportingClaimIds.length === 0 ||
          factor.evidenceIds.length === 0 ||
          !factor.supportingClaimIds.some(
            (claimId) =>
              Boolean(
                input.claims
                  .find(({ id }) => id === claimId)
                  ?.applicability.factorKeys.includes(factor.factorKey),
              ) &&
              isVerifiableClaim(
                input.claims.find(({ id }) => id === claimId),
                new Map(input.evidence.map((item) => [item.id, item] as const)),
                factor.evidenceIds,
              ),
          ));
      if (!unsupportedObservation) return factor;
      return {
        ...factor,
        state: "unknown" as const,
        strength: 0,
        confidence: 0,
        supportingClaimIds: [],
        counterClaimIds: [],
        evidenceIds: [],
        missingEvidence: uniqueSorted([
          ...factor.missingEvidence,
          "Recorded claims and evidence do not support an observed factor state.",
        ]),
        conciseExplanation:
          "The recorded claims and evidence are insufficient to resolve this factor.",
        criticalGateRecommendation: "unresolved" as const,
      };
    }),
  };
  const results = output.factors
    .map(
      (
        factor,
      ): FactorEvaluation & {
        explanation: string;
        missingEvidence: string[];
      } => {
        assertKnownIds(
          [...factor.supportingClaimIds, ...factor.counterClaimIds],
          claimIds,
          `Factor "${factor.factorKey}" cited a claim outside its frozen context.`,
        );
        assertKnownIds(
          factor.evidenceIds,
          evidenceIds,
          `Factor "${factor.factorKey}" cited evidence outside its frozen context.`,
        );
        const evidenceQuality = calculateEvidenceQuality(
          factor.evidenceIds.map((id) => evidenceById.get(id)!),
        );
        const strength = factor.strength / 3;
        const criticalGateState = {
          pass: "passed",
          fail: "failed",
          unresolved: "unresolved",
          not_applicable: "not_applicable",
        }[factor.criticalGateRecommendation] as FactorEvaluation["criticalGateState"];
        return {
          factorKey: factor.factorKey,
          applicability:
            factor.state === "not_applicable" ? "not_applicable" : "applicable",
          state: factor.state,
          ...(factor.state === "positive" ? { signedValue: strength } : {}),
          ...(factor.state === "negative" ? { signedValue: -strength } : {}),
          ...(factor.state === "positive" ? { potentialValue: strength } : {}),
          ...(factor.state === "negative" ? { potentialValue: 0 } : {}),
          confidence: factor.confidence,
          evidenceQuality,
          evidenceIds: uniqueSorted(factor.evidenceIds),
          counterEvidenceIds: uniqueSorted(
            factor.counterClaimIds.flatMap(
              (claimId) =>
                input.claims.find(({ id }) => id === claimId)?.evidenceIds ?? [],
            ),
          ),
          criticalGateState,
          explanation: factor.conciseExplanation,
          missingEvidence: uniqueSorted(factor.missingEvidence),
        };
      },
    )
    .sort((left, right) => left.factorKey.localeCompare(right.factorKey));
  return { output, evaluations: results };
}

export function buildRelationshipClassificationMessages(input: {
  objective: unknown;
  desiredRelationships: CandidateRelationship[];
  normallyExcludedRelationships: CandidateRelationship[];
  organization: unknown;
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
  commercialRelationshipAssessment?: CommercialRelationshipAssessment;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "Classify one candidate organization's commercial relationship to the seller for the frozen campaign objective.",
        "Industry similarity is not enough.",
        "Use only supplied claims and evidence metadata.",
        "Treat the supplied multi-dimensional relationship assessment as a frozen evidence-bounded prior, not as a final eligibility decision.",
        "Use a claim only for the Campaign dimensions listed in its applicability object.",
        "A relationship requires a verifiable explicit fact or evidence-backed inference whose cited evidence is linked to that claim.",
        "Do not apply final eligibility rules or calculate fit.",
        "Return unknown when evidence is insufficient.",
        "Cite supplied claim IDs only and return one compact JSON object.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        objective: input.objective,
        desiredRelationships: input.desiredRelationships,
        normallyExcludedRelationships: input.normallyExcludedRelationships,
        organization: input.organization,
        commercialRelationshipAssessment: input.commercialRelationshipAssessment ?? null,
        claims: input.claims,
        evidence: input.evidence,
        outputSchema: {
          primaryRelationship: candidateRelationships.join(" | "),
          secondaryRelationships: [candidateRelationships.join(" | ")],
          objectiveCompatibility:
            "compatible | conditionally_compatible | incompatible | unknown",
          confidence: "number 0-1",
          positiveClaimIds: ["supplied claim ID"],
          negativeClaimIds: ["supplied claim ID"],
          conflictClaimIds: ["supplied claim ID"],
          missingEvidence: ["specific unresolved evidence"],
          conciseRationale: "evidence-bounded rationale",
        },
      }),
    },
  ];
}

export function buildFactorEvaluationMessages(input: {
  objective: unknown;
  relationship: RelationshipClassificationOutput;
  factors: RuntimeQualificationFactor[];
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
}) {
  return [
    {
      role: "system" as const,
      content: [
        "Evaluate every supplied qualification factor independently from recorded claims and evidence.",
        "Use only claims whose applicability.factorKeys contains the exact factor key.",
        "Cited evidence must be linked to the cited supporting claim; unrelated evidence cannot support a factor.",
        "Use the exact factor definitions and policies supplied.",
        "Do not invent evidence or treat missing evidence as negative.",
        "Use unknown for insufficient evidence and conflicting for material disagreement.",
        "Positive or negative requires nonzero strength, at least one supplied supporting claim ID, and at least one supplied evidence ID; otherwise return unknown.",
        "Do not calculate a final fit, potential, confidence, eligibility, lane, or rank.",
        "Return exactly one record per supplied factor key in one compact JSON object.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        objective: input.objective,
        relationship: input.relationship,
        factorDefinitions: input.factors,
        claims: input.claims,
        evidence: input.evidence,
        outputSchema: {
          factors: input.factors.map(({ key }) => ({
            factorKey: key,
            state: "positive | negative | unknown | conflicting | not_applicable",
            strength: "integer 0-3",
            confidence: "number 0-1",
            supportingClaimIds: ["supplied claim ID"],
            counterClaimIds: ["supplied claim ID"],
            evidenceIds: ["supplied evidence ID"],
            missingEvidence: ["specific unresolved evidence"],
            conciseExplanation: "evidence-bounded explanation",
            criticalGateRecommendation: "pass | fail | unresolved | not_applicable",
          })),
        },
      }),
    },
  ];
}

export type RelationshipClassificationRequest = Parameters<
  typeof buildRelationshipClassificationMessages
>[0];
export type FactorEvaluationRequest = Parameters<typeof buildFactorEvaluationMessages>[0];

export const qualificationRelationshipTaskDefinition: PromptDefinition<
  RelationshipClassificationRequest,
  RelationshipClassificationOutput
> = {
  taskId: "candidate.relationship_classification",
  promptVersion: QUALIFICATION_RELATIONSHIP_PROMPT_VERSION,
  schemaVersion: "candidate-relationship-output/v2.2",
  contextCompilerVersion: "candidate-qualification-context/v2.4",
  modelRole: "candidate_relationship_reasoning",
  title: "Candidate relationship classification",
  description:
    "Classify one evidence-bounded commercial relationship without deciding eligibility.",
  buildMessages: buildRelationshipClassificationMessages,
  outputSchema: relationshipOutputSchema,
  maxCompletionTokens: 2_000,
  reasoningClass: "minimal",
  allowsRepair: true,
  allowsFallback: true,
};

export const qualificationFactorTaskDefinition: PromptDefinition<
  FactorEvaluationRequest,
  FactorEvaluationOutput
> = {
  taskId: "candidate.factor_evaluation",
  promptVersion: QUALIFICATION_FACTOR_PROMPT_VERSION,
  schemaVersion: "candidate-factor-output/v2.2",
  contextCompilerVersion: "candidate-qualification-context/v2.3",
  modelRole: "candidate_factor_evaluation",
  title: "Candidate qualification-factor evaluation",
  description:
    "Evaluate every frozen factor independently without calculating final decisions.",
  buildMessages: buildFactorEvaluationMessages,
  outputSchema: factorOutputSchema,
  maxCompletionTokens: 5_000,
  reasoningClass: "minimal",
  allowsRepair: true,
  allowsFallback: true,
};

export function mapCampaignRelationshipsToQualification(
  values: string[],
): CandidateRelationship[] {
  const mapped = values.map((value): CandidateRelationship => {
    if (value === "direct_buyer") return "probable_buyer";
    if (value === "end_user_customer") return "end_user";
    if (value === "implementation_partner") return "integration_partner";
    if (value === "marketplace_participant") return "channel_partner";
    if (value === "acquisition_target" || value === "investor_target")
      return "investor_or_acquirer";
    if (value === "other") return "unknown";
    if ((candidateRelationships as readonly string[]).includes(value))
      return value as CandidateRelationship;
    return "unknown";
  });
  return uniqueSorted(mapped);
}

function calculateEvidenceQuality(evidence: QualificationEvidence[]) {
  if (evidence.length === 0) return 0;
  const reliability = {
    first_party: 1,
    authoritative_registry: 1,
    trusted_directory: 0.8,
    reputable_secondary: 0.7,
    unverified_secondary: 0.4,
  } as const;
  const directness = {
    direct: 1,
    indirect: 0.75,
    reported: 0.6,
    unknown: 0.25,
  } as const;
  const freshness = {
    current: 1,
    recent: 0.85,
    stale: 0.45,
    unknown: 0.35,
  } as const;
  return (
    evidence.reduce(
      (sum, item) =>
        sum +
        (reliability[item.sourceReliability] +
          directness[item.directness] +
          freshness[item.freshnessState]) /
          3,
      0,
    ) / evidence.length
  );
}

export function isVerifiableClaim(
  claim: QualificationClaim | undefined,
  evidenceById: Map<string, QualificationEvidence>,
  citedEvidenceIds?: string[],
) {
  if (
    !claim ||
    !["explicit_fact", "evidence_backed_inference"].includes(claim.epistemicStatus)
  ) {
    return false;
  }
  const cited = new Set(citedEvidenceIds ?? claim.evidenceIds);
  return claim.evidenceIds.some((id) => {
    if (!cited.has(id)) return false;
    const evidence = evidenceById.get(id);
    return (
      Boolean(evidence?.excerpt?.trim()) &&
      evidence?.directness !== "unknown" &&
      evidence?.freshnessState !== "stale"
    );
  });
}

export function compileHardExclusions(input: {
  rules: IntelligenceRule[];
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
  questionFindings: Array<{
    questionKey: string;
    state: "answered_positive" | "answered_negative" | "unknown" | "conflicting";
    claimIds: string[];
    conciseAnswer: string;
  }>;
}) {
  const claimById = new Map(input.claims.map((claim) => [claim.id, claim] as const));
  const evidenceById = new Map(
    input.evidence.map((evidence) => [evidence.id, evidence] as const),
  );
  const findingByKey = new Map(
    input.questionFindings.map((finding) => [finding.questionKey, finding] as const),
  );
  return input.rules
    .map((rule) => {
      const finding = findingByKey.get(`exclusion.${rule.ruleKey}`);
      const applicableClaims = (finding?.claimIds ?? [])
        .map((claimId) => claimById.get(claimId))
        .filter(
          (claim): claim is QualificationClaim =>
            Boolean(claim) &&
            claim!.applicability.exclusionRuleKeys.includes(rule.ruleKey) &&
            isVerifiableClaim(claim, evidenceById),
        );
      const evidenceIds = uniqueSorted(
        applicableClaims.flatMap((claim) => claim.evidenceIds),
      );
      const confirmed = rule.status === "confirmed";
      const state: ExclusionAssessment["state"] =
        finding?.state === "answered_positive" && applicableClaims.length > 0
          ? confirmed
            ? "triggered"
            : "suspected"
          : finding?.state === "answered_negative" && applicableClaims.length > 0
            ? "not_triggered"
            : finding?.state === "conflicting"
              ? "suspected"
              : "unknown";
      const confidence = applicableClaims.length
        ? applicableClaims.reduce((sum, claim) => sum + claim.confidence, 0) /
          applicableClaims.length
        : 0;
      return {
        ruleId: rule.ruleKey,
        strength: "hard" as const,
        state,
        confidence,
        evidenceIds,
        effect:
          state === "triggered"
            ? ("exclude" as const)
            : state === "suspected" || state === "unknown"
              ? ("requires_research" as const)
              : ("none" as const),
        reason:
          finding?.conciseAnswer ??
          "The frozen evidence did not resolve this exclusion rule.",
      };
    })
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function assertKnownIds(values: string[], allowed: Set<string>, message: string) {
  if (values.some((id) => !allowed.has(id))) throw new Error(message);
}

function uniqueSorted<T extends string>(values: T[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
