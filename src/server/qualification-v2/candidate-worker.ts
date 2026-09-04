import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { generateTextResult, type AiCallResult } from "@/lib/providers/openrouter";
import { executeValidatedAiTask } from "@/lib/intelligence/runtime/execute-ai-task";
import {
  IntelligenceTaskRegistry,
  type PromptDefinition,
} from "@/lib/intelligence/runtime/task-registry";
import { IntelligenceSchemaRegistry } from "@/lib/intelligence/runtime/schema-registry";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";
import { runBudgetedOpenRouterCall } from "@/server/credits/budgeted-provider-call";
import {
  QUALIFICATION_CONFIDENCE_POLICY_VERSION,
  QUALIFICATION_FACTOR_PROMPT_VERSION,
  QUALIFICATION_RELATIONSHIP_PROMPT_VERSION,
  assignReviewLane,
  qualificationFactorTaskDefinition,
  qualificationRelationshipTaskDefinition,
  calculateConfidence,
  calculateFit,
  calculatePotential,
  calculateOpportunityTiming,
  compileHardExclusions,
  suppressFitWhenEvidenceIsInsufficient,
  decideEligibility,
  normalizeFactorEvaluations,
  normalizeRelationshipClassification,
  type CandidateEligibility,
  type CandidateReviewLane,
  type FactorEvaluationOutput,
  type RelationshipClassificationOutput,
} from "@/lib/qualification-v2";
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
    commercialRelationshipAssessment: member.commercialRelationshipAssessment ?? null,
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
  const opportunityTiming = calculateOpportunityTiming({
    definitions: factors,
    evaluations: factorResult.evaluations,
    evidence: member.evidence,
  });
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
  const reportableFit = suppressFitWhenEvidenceIsInsufficient(
    fit,
    confidence.evidenceCoverage,
    member.rubric.thresholds.minimumEvidenceCoverage,
  );
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
    fitScore: reportableFit.score,
    rejectBelowFit: member.rubric.thresholds.rejectBelowFit,
    limitingCondition:
      relationship.output.objectiveCompatibility === "conditionally_compatible",
  });
  const lane = assignReviewLane({
    eligibility,
    fitScore: reportableFit.score,
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
    fitScore: reportableFit.score,
    potentialScore: potential.score,
    confidence: confidence.score,
    confidenceCaps: confidence.caps,
    exclusions,
    factors: factorResult.evaluations,
  });
  const finalSnapshot = {
    campaignCandidateId: member.campaignCandidateId,
    campaignStrategyVersionId: member.strategyVersionId,
    candidateIntelligenceVersionId: member.candidateIntelligenceVersionId,
    companyIntelligenceVersionId:
      "companyIntelligenceVersionId" in member
        ? member.companyIntelligenceVersionId
        : null,
    commercialRelationshipAssessmentVersionId:
      member.commercialRelationshipAssessment?.id ?? null,
    commercialRelationshipDimensions:
      member.commercialRelationshipAssessment?.relationships ?? null,
    claimApplicability: member.claims.map(({ id, applicability }) => ({
      claimId: id,
      applicability,
    })),
    qualificationRubricContentHash: member.rubric.contentHash,
    relationship: relationship.assessment,
    objectiveCompatibility: relationship.output.objectiveCompatibility,
    exclusions,
    factorEvaluations: factorResult.evaluations,
    fit: reportableFit,
    commercialPotential: potential,
    opportunityTiming,
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
    fit: reportableFit as unknown as Json,
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
  const request = {
    objective: input.member.objective,
    desiredRelationships: input.member.rubric.desiredRelationships,
    normallyExcludedRelationships: input.member.rubric.normallyExcludedRelationships,
    organization: input.member.organization,
    commercialRelationshipAssessment: input.member.commercialRelationshipAssessment,
    claims: input.member.claims,
    evidence: input.member.evidence,
  };
  const startedAt = new Date().toISOString();
  assertIntelligenceExternalCallsAllowed("model");
  const generated = await executeQualificationAiTask({
    definition: qualificationRelationshipTaskDefinition,
    request,
    requestHash: input.requestHash,
    member: input.member,
    semanticValidate: (output) => {
      normalizeRelationshipClassification({
        raw: output,
        claims: input.member.claims,
        evidence: input.member.evidence,
      });
    },
  });
  const normalized = normalizeRelationshipClassification({
    raw: generated.output,
    claims: input.member.claims,
    evidence: input.member.evidence,
  });
  const saved = await saveQualificationAiOutput({
    memberId: input.member.memberId,
    workspaceId: input.member.workspaceId,
    taskType: "relationship",
    requestHash: input.requestHash,
    output: normalized.output as unknown as Json,
    modelCall: generated.modelCall,
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
  const request = {
    objective: input.member.objective,
    relationship: input.relationship,
    factors,
    claims: input.member.claims,
    evidence: input.member.evidence,
  };
  const startedAt = new Date().toISOString();
  assertIntelligenceExternalCallsAllowed("model");
  const generated = await executeQualificationAiTask({
    definition: qualificationFactorTaskDefinition,
    request,
    requestHash: input.requestHash,
    member: input.member,
    semanticValidate: (output) => {
      normalizeFactorEvaluations({
        raw: output,
        factors,
        claims: input.member.claims,
        evidence: input.member.evidence,
      });
    },
  });
  const normalized = normalizeFactorEvaluations({
    raw: generated.output,
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
    modelCall: generated.modelCall,
    startedAt,
  });
  return { ...normalized, aiRequestId: saved.aiRequestId };
}

async function executeQualificationAiTask<TRequest, TOutput>(input: {
  definition: PromptDefinition<TRequest, TOutput>;
  request: TRequest;
  requestHash: string;
  member: QualificationMemberContext;
  semanticValidate: (output: TOutput) => void;
}) {
  const tasks = new IntelligenceTaskRegistry();
  tasks.register(input.definition);
  const schemas = new IntelligenceSchemaRegistry();
  schemas.register({
    taskId: input.definition.taskId,
    schemaVersion: input.definition.schemaVersion,
    schema: input.definition.outputSchema,
    semanticValidators: [(output) => input.semanticValidate(output)],
  });
  const result = await executeValidatedAiTask<TRequest, TOutput>({
    registry: tasks,
    schemas,
    taskId: input.definition.taskId,
    promptVersion: input.definition.promptVersion,
    modelRouteVersion: "candidate-qualification-route/v1",
    request: input.request,
    recordAttempt: createIntelligenceAttemptRecorder({
      workspaceId: input.member.workspaceId,
      frozenInputHash: input.requestHash,
      metadata: {
        memberId: input.member.memberId,
        campaignCandidateId: input.member.campaignCandidateId,
      },
    }),
    transport: async (transportRequest) => {
      const call = await runBudgetedOpenRouterCall({
        workspaceId: input.member.workspaceId,
        campaignRunId: input.member.campaignRunId,
        operation: "company_research_qualification",
        idempotencyKey: `company-qualification:${input.member.memberId}:${input.requestHash}`,
        execute: () =>
          generateTextResult(transportRequest.messages, {
            role: "company_qualification",
            maxCompletionTokens: transportRequest.maxCompletionTokens,
            reasoningEffort:
              transportRequest.reasoningClass === "standard"
                ? "medium"
                : transportRequest.reasoningClass,
            taskName: input.definition.title,
            ...(transportRequest.output.mode === "json_schema"
              ? { jsonSchema: transportRequest.output }
              : { jsonMode: true }),
          }),
      });
      return {
        output: call.data,
        requestedModel: call.requestedModel,
        actualModel: call.actualModel ?? call.requestedModel,
        fallbackUsed: call.fallbackUsed,
        requestHash: hashCanonical(transportRequest.messages),
        responseHash: hashCanonical(call.data),
        latencyMs: call.latencyMs,
        inputUnits: call.inputTokens,
        outputUnits: call.outputTokens,
        actualCost: call.providerReportedCost,
        currency: call.providerCurrency,
      };
    },
  });
  return {
    output: result.data,
    modelCall: aiCallFromResult(result),
  };
}

function aiCallFromResult<T>(
  result: Awaited<ReturnType<typeof executeValidatedAiTask<unknown, T>>>,
): AiCallResult<string> {
  return {
    data: JSON.stringify(result.data),
    provider: "openrouter",
    requestedModel: result.provenance.requestedModel,
    actualModel: result.provenance.actualModel,
    fallbackUsed: result.provenance.fallbackUsed,
    inputTokens: result.provenance.inputUnits,
    outputTokens: result.provenance.outputUnits,
    providerReportedCost: result.provenance.actualCost,
    providerCurrency: result.provenance.currency === "USD" ? "USD" : undefined,
    latencyMs: result.provenance.latencyMs ?? 0,
  };
}

export function compileExclusions(member: QualificationMemberContext) {
  return compileHardExclusions({
    rules: member.rubric.hardExclusionRules,
    claims: member.claims,
    evidence: member.evidence,
    questionFindings: member.questionFindings,
  });
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
  confidenceCaps: string[];
  exclusions: Array<{ ruleId: string; state: string; effect: string }>;
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
  const decisiveExclusions = input.exclusions
    .filter(({ state }) => ["triggered", "suspected", "unknown"].includes(state))
    .map(({ ruleId, state }) => `${ruleId}: ${state}`)
    .slice(0, 3)
    .join("; ");
  return [
    `Relationship: ${input.relationship.primaryRelationship} (${Math.round(input.relationship.confidence * 100)}% confidence).`,
    `Eligibility: ${input.eligibility}; review lane: ${input.lane}.`,
    `Fit: ${input.fitScore ?? "not enough evidence"}; commercial potential: ${input.potentialScore ?? "not enough evidence"}; confidence: ${input.confidence}.`,
    observed ? `Observed factors: ${observed}.` : "No scored factor was observed.",
    unresolved ? `Unresolved factors: ${unresolved}.` : "",
    decisiveExclusions ? `Exclusion checks: ${decisiveExclusions}.` : "",
    input.confidenceCaps.length
      ? `Confidence caps: ${input.confidenceCaps.join(", ")}.`
      : "",
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
