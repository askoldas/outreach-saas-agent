import { parseCompleteJsonObject } from "@/lib/ai/structured-json";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { generateTextResult } from "@/lib/providers/openrouter";
import {
  QUALIFICATION_CONFIDENCE_POLICY_VERSION,
  QUALIFICATION_FACTOR_PROMPT_VERSION,
  QUALIFICATION_RELATIONSHIP_PROMPT_VERSION,
  assignReviewLane,
  buildFactorEvaluationMessages,
  buildRelationshipClassificationMessages,
  calculateConfidence,
  calculateFit,
  calculatePotential,
  decideEligibility,
  normalizeFactorEvaluations,
  normalizeRelationshipClassification,
  type CandidateEligibility,
  type CandidateReviewLane,
  type ExclusionAssessment,
  type FactorEvaluationOutput,
  type RelationshipClassificationOutput,
} from "@/lib/qualification-v2";
import type { IntelligenceRule } from "@/lib/intelligence/contracts/rules";
import type { Json } from "@/types/database.types";
import {
  claimQualificationMember,
  completeQualificationMember,
  parseQualificationMemberResult,
  qualificationFactorDefinitions,
  saveQualificationAiOutput,
  type QualificationMemberContext,
} from "./repository";

export async function executeQualificationMember(input: {
  memberId: string;
  triggerRunId: string;
  workspaceId: string;
}) {
  const member = await claimQualificationMember(input);
  if (member.status === "completed" || member.status === "blocked") {
    return parseQualificationMemberResult(member.outputReference);
  }
  const factors = qualificationFactorDefinitions(member);
  const relationshipRequestHash = hashCanonical({
    memberInputHash: member.inputHash,
    promptVersion: QUALIFICATION_RELATIONSHIP_PROMPT_VERSION,
    objective: member.objective,
    claims: member.claims,
    evidence: member.evidence,
  });
  const relationship = await evaluateRelationship({
    member,
    requestHash: relationshipRequestHash,
  });
  const factorRequestHash = hashCanonical({
    memberInputHash: member.inputHash,
    promptVersion: QUALIFICATION_FACTOR_PROMPT_VERSION,
    relationship: relationship.output,
    factors,
    claims: member.claims,
    evidence: member.evidence,
  });
  const factorResult = await evaluateFactors({
    member,
    relationship: relationship.output,
    requestHash: factorRequestHash,
  });

  const exclusions = compileExclusions(member);
  const fit = calculateFit(factors, factorResult.evaluations);
  const potential = calculatePotential(factors, factorResult.evaluations);
  const confidence = calculateConfidence({
    definitions: factors,
    evaluations: factorResult.evaluations,
    identityConfidence: member.organization.identityConfidence,
    relationshipConfidence: relationship.assessment.confidence,
    procurementConfidence: member.procurementConfidence,
    procurementCritical: member.procurementCritical,
    unresolvedIdentity:
      member.organization.identityReviewState === "needs_review" ||
      member.organization.identityConfidence < 0.6,
    suspectedHardExclusion: exclusions.some(
      ({ strength, state }) =>
        strength === "hard" && ["suspected", "unknown"].includes(state),
    ),
  });
  const eligibility = decideEligibility({
    validEntity: member.validEntity,
    merged: member.merged,
    relationship: relationship.assessment.primaryRelationship,
    relationshipConfidence: relationship.assessment.confidence,
    desiredRelationships: member.rubric.desiredRelationships,
    exclusions,
    factorEvaluations: factorResult.evaluations,
    evidenceCoverage: confidence.evidenceCoverage,
    minimumEvidenceCoverage: member.rubric.thresholds.minimumEvidenceCoverage,
    fitScore: fit.score,
    rejectBelowFit: member.rubric.thresholds.rejectBelowFit,
    limitingCondition:
      relationship.output.objectiveCompatibility === "conditionally_compatible",
  });
  const lane = assignReviewLane({
    eligibility,
    fitScore: fit.score,
    confidence: confidence.score,
    minimumFitForRecommended: member.rubric.thresholds.minimumFitForRecommended,
    minimumFitForConditional: member.rubric.thresholds.minimumFitForConditional,
    minimumConfidenceForRecommended:
      member.rubric.thresholds.minimumConfidenceForRecommended,
  });
  const aiRequestIds = uniqueSorted([
    ...(relationship.aiRequestId ? [relationship.aiRequestId] : []),
    ...(factorResult.aiRequestId ? [factorResult.aiRequestId] : []),
  ]);
  const explanation = buildDeterministicExplanation({
    relationship: relationship.output,
    eligibility,
    lane,
    fitScore: fit.score,
    potentialScore: potential.score,
    confidence: confidence.score,
    factors: factorResult.evaluations,
  });
  const finalSnapshot = {
    campaignCandidateId: member.campaignCandidateId,
    campaignStrategyVersionId: member.strategyVersionId,
    candidateIntelligenceVersionId: member.candidateIntelligenceVersionId,
    qualificationRubricContentHash: member.rubric.contentHash,
    relationship: relationship.assessment,
    objectiveCompatibility: relationship.output.objectiveCompatibility,
    exclusions,
    factorEvaluations: factorResult.evaluations,
    fit,
    commercialPotential: potential,
    confidence,
    eligibility,
    lane,
    policies: {
      scoring: member.rubric.scoringPolicyVersion,
      confidence: QUALIFICATION_CONFIDENCE_POLICY_VERSION,
      relationship: member.rubric.relationshipClassifierVersion,
      exclusion: member.rubric.exclusionPolicyVersion,
    },
    aiRequestIds,
  };
  return completeQualificationMember({
    memberId: member.memberId,
    workspaceId: input.workspaceId,
    relationshipRequestHash,
    factorRequestHash,
    relationship: {
      ...relationship.assessment,
      objectiveCompatibility: relationship.output.objectiveCompatibility,
      conciseRationale: relationship.output.conciseRationale,
    } as unknown as Json,
    exclusions: exclusions as unknown as Json,
    factors: factorResult.evaluations as unknown as Json,
    fit: fit as unknown as Json,
    potential: potential as unknown as Json,
    confidence: confidence as unknown as Json,
    eligibility: eligibilityRecord(eligibility) as unknown as Json,
    lane: laneRecord(lane, eligibility) as unknown as Json,
    explanation,
    aiRequestIds: aiRequestIds as Json,
    finalSnapshot: finalSnapshot as unknown as Json,
  });
}

async function evaluateRelationship(input: {
  member: QualificationMemberContext;
  requestHash: string;
}) {
  if (input.member.claims.length === 0) {
    const output = unknownRelationshipOutput();
    return {
      ...normalizeRelationshipClassification({
        raw: output,
        claims: input.member.claims,
        evidence: input.member.evidence,
      }),
      aiRequestId: null,
    };
  }
  const cached = input.member.cachedOutputs.find(
    ({ taskType, requestHash }) =>
      taskType === "relationship" && requestHash === input.requestHash,
  );
  if (cached) {
    return {
      ...normalizeRelationshipClassification({
        raw: cached.output,
        claims: input.member.claims,
        evidence: input.member.evidence,
      }),
      aiRequestId: cached.aiRequestId,
    };
  }
  const messages = buildRelationshipClassificationMessages({
    objective: input.member.objective,
    desiredRelationships: input.member.rubric.desiredRelationships,
    normallyExcludedRelationships: input.member.rubric.normallyExcludedRelationships,
    organization: input.member.organization,
    claims: input.member.claims,
    evidence: input.member.evidence,
  });
  const startedAt = new Date().toISOString();
  const modelCall = await generateTextResult(messages, {
    role: "company_qualification",
    jsonMode: true,
    maxCompletionTokens: 2_000,
    reasoningEffort: "minimal",
    taskName: "V2 candidate relationship classification",
  });
  const normalized = normalizeRelationshipClassification({
    raw: parseCompleteJsonObject(modelCall.data),
    claims: input.member.claims,
    evidence: input.member.evidence,
  });
  const saved = await saveQualificationAiOutput({
    memberId: input.member.memberId,
    workspaceId: input.member.workspaceId,
    taskType: "relationship",
    requestHash: input.requestHash,
    output: normalized.output as unknown as Json,
    modelCall,
    startedAt,
  });
  return { ...normalized, aiRequestId: saved.aiRequestId };
}

async function evaluateFactors(input: {
  member: QualificationMemberContext;
  relationship: RelationshipClassificationOutput;
  requestHash: string;
}) {
  const factors = qualificationFactorDefinitions(input.member);
  if (input.member.claims.length === 0) {
    const output = unknownFactorOutput(factors.map(({ key }) => key));
    return {
      ...normalizeFactorEvaluations({
        raw: output,
        factors,
        claims: input.member.claims,
        evidence: input.member.evidence,
      }),
      aiRequestId: null,
    };
  }
  const cached = input.member.cachedOutputs.find(
    ({ taskType, requestHash }) =>
      taskType === "factors" && requestHash === input.requestHash,
  );
  if (cached) {
    return {
      ...normalizeFactorEvaluations({
        raw: cached.output,
        factors,
        claims: input.member.claims,
        evidence: input.member.evidence,
      }),
      aiRequestId: cached.aiRequestId,
    };
  }
  const messages = buildFactorEvaluationMessages({
    objective: input.member.objective,
    relationship: input.relationship,
    factors,
    claims: input.member.claims,
    evidence: input.member.evidence,
  });
  const startedAt = new Date().toISOString();
  const modelCall = await generateTextResult(messages, {
    role: "company_qualification",
    jsonMode: true,
    maxCompletionTokens: 5_000,
    reasoningEffort: "minimal",
    taskName: "V2 candidate factor evaluation",
  });
  const normalized = normalizeFactorEvaluations({
    raw: parseCompleteJsonObject(modelCall.data),
    factors,
    claims: input.member.claims,
    evidence: input.member.evidence,
  });
  const saved = await saveQualificationAiOutput({
    memberId: input.member.memberId,
    workspaceId: input.member.workspaceId,
    taskType: "factors",
    requestHash: input.requestHash,
    output: normalized.output as unknown as Json,
    modelCall,
    startedAt,
  });
  return { ...normalized, aiRequestId: saved.aiRequestId };
}

function compileExclusions(member: QualificationMemberContext) {
  const claimById = new Map(member.claims.map((claim) => [claim.id, claim] as const));
  const findingByKey = new Map(
    member.questionFindings.map((finding) => [finding.questionKey, finding] as const),
  );
  return (member.rubric.hardExclusionRules as IntelligenceRule[])
    .map((rule) => {
      const finding = findingByKey.get(`exclusion.${rule.ruleKey}`);
      const evidenceIds = uniqueSorted([
        ...(finding?.evidenceIds ?? []),
        ...(finding?.claimIds ?? []).flatMap(
          (claimId) => claimById.get(claimId)?.evidenceIds ?? [],
        ),
      ]);
      const confirmed = rule.status === "confirmed";
      const state: ExclusionAssessment["state"] =
        finding?.state === "answered_positive" && evidenceIds.length > 0
          ? confirmed
            ? "triggered"
            : "suspected"
          : finding?.state === "answered_negative" && evidenceIds.length > 0
            ? "not_triggered"
            : finding?.state === "conflicting"
              ? "suspected"
              : "unknown";
      const confidence =
        finding?.claimIds.length && evidenceIds.length
          ? finding.claimIds.reduce(
              (sum, claimId) => sum + (claimById.get(claimId)?.confidence ?? 0),
              0,
            ) / finding.claimIds.length
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

function eligibilityRecord(eligibility: CandidateEligibility) {
  const reasons: Record<CandidateEligibility, string> = {
    eligible: "All deterministic eligibility gates passed.",
    conditional: "The candidate is plausible with a confirmed limiting condition.",
    requires_research:
      "A critical relationship, exclusion, or factor remains unresolved.",
    excluded: "A deterministic relationship or hard-exclusion gate failed.",
    rejected: "Observed fit is below the campaign rejection threshold.",
    invalid_entity: "The resolved record is not a valid active target entity.",
    duplicate_or_merged: "The candidate resolves to another canonical organization.",
  };
  return {
    state: eligibility,
    reasonCode: `qualification.${eligibility}`,
    reasonText: reasons[eligibility],
    decidedBy: "rules",
  };
}

function laneRecord(lane: CandidateReviewLane, eligibility: CandidateEligibility) {
  return {
    lane,
    reason: `Deterministic lane assignment from eligibility "${eligibility}".`,
  };
}

function buildDeterministicExplanation(input: {
  relationship: RelationshipClassificationOutput;
  eligibility: CandidateEligibility;
  lane: CandidateReviewLane;
  fitScore: number | null;
  potentialScore: number | null;
  confidence: number;
  factors: Array<{
    factorKey: string;
    state: string;
    explanation: string;
  }>;
}) {
  const observed = input.factors
    .filter(({ state }) => state === "positive" || state === "negative")
    .slice(0, 3)
    .map(({ factorKey, state }) => `${factorKey}: ${state}`)
    .join("; ");
  const unresolved = input.factors
    .filter(({ state }) => state === "unknown" || state === "conflicting")
    .map(({ factorKey }) => factorKey)
    .slice(0, 4)
    .join(", ");
  return [
    `Relationship: ${input.relationship.primaryRelationship} (${Math.round(input.relationship.confidence * 100)}% confidence).`,
    `Eligibility: ${input.eligibility}; review lane: ${input.lane}.`,
    `Fit: ${input.fitScore ?? "not enough evidence"}; commercial potential: ${input.potentialScore ?? "not enough evidence"}; confidence: ${input.confidence}.`,
    observed ? `Observed factors: ${observed}.` : "No scored factor was observed.",
    unresolved ? `Unresolved factors: ${unresolved}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1_600);
}

function unknownRelationshipOutput(): RelationshipClassificationOutput {
  return {
    primaryRelationship: "unknown",
    secondaryRelationships: [],
    objectiveCompatibility: "unknown",
    confidence: 0,
    positiveClaimIds: [],
    negativeClaimIds: [],
    conflictClaimIds: [],
    missingEvidence: [
      "No recorded claims were available for relationship classification.",
    ],
    conciseRationale: "The recorded evidence is insufficient to classify a relationship.",
  };
}

function unknownFactorOutput(keys: string[]): FactorEvaluationOutput {
  return {
    factors: keys.map((factorKey) => ({
      factorKey,
      state: "unknown",
      strength: 0,
      confidence: 0,
      supportingClaimIds: [],
      counterClaimIds: [],
      evidenceIds: [],
      missingEvidence: ["No recorded claims were available for this factor."],
      conciseExplanation: "The recorded evidence does not resolve this factor.",
      criticalGateRecommendation: "unresolved",
    })),
  };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
