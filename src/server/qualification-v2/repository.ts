import { z } from "zod";
import type { AiCallResult } from "@/lib/providers/openrouter";
import type {
  QualificationClaim,
  QualificationEvidence,
  QualificationRubricRuntime,
  RuntimeQualificationFactor,
} from "@/lib/qualification-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const qualificationCandidateInputSchema = z
  .object({
    campaignCandidateId: z.string().min(1),
    organizationId: z.string().min(1),
    candidateIntelligenceVersionId: z.string().min(1),
    intelligenceContentHash: z.string().length(64),
    state: z.string().min(1),
    identityConfidence: z.number().min(0).max(1),
    identityReviewState: z.string().min(1),
    operatingStatus: z.string().min(1),
    mergedIntoOrganizationId: z.string().nullable(),
    procurementAutonomy: z.string().nullable(),
    procurementConfidence: z.number().min(0).max(1).nullable(),
  })
  .strict();

const qualificationContextSchema = z
  .object({
    schemaVersion: z.literal(2),
    campaignRunId: z.string().min(1),
    campaignId: z.string().min(1),
    strategyVersionId: z.string().min(1),
    strategy: z.unknown(),
    researchBatchId: z.string().min(1),
    candidates: z.array(qualificationCandidateInputSchema),
  })
  .strict();

const qualificationBatchSchema = z
  .object({
    schemaVersion: z.literal(2),
    batchId: z.string().min(1),
    campaignRunId: z.string().min(1),
    contractVersion: z.string().min(1),
    inputHash: z.string().length(64),
    status: z.string().min(1),
    candidateCount: z.number().int().nonnegative(),
    memberIds: z.array(z.string().min(1)),
    pendingMemberIds: z.array(z.string().min(1)),
    reusedMemberCount: z.number().int().nonnegative(),
  })
  .strict();

const claimSchema = z
  .object({
    id: z.string().min(1),
    key: z.string().min(1),
    statement: z.string().min(1),
    value: z.unknown(),
    epistemicStatus: z.enum([
      "explicit_fact",
      "evidence_backed_inference",
      "hypothesis",
      "unknown",
      "conflict",
    ]),
    confidence: z.number().min(0).max(1),
    evidenceIds: z.array(z.string().min(1)),
  })
  .strict();

const evidenceSchema = z
  .object({
    id: z.string().min(1),
    evidenceType: z.string().min(1),
    excerpt: z.string().nullable(),
    directness: z.enum(["direct", "indirect", "reported", "unknown"]),
    sourceReliability: z.enum([
      "first_party",
      "authoritative_registry",
      "trusted_directory",
      "reputable_secondary",
      "unverified_secondary",
    ]),
    freshnessState: z.enum(["current", "recent", "stale", "unknown"]),
  })
  .strict();

const questionFindingSchema = z
  .object({
    questionKey: z.string().min(1),
    state: z.enum(["answered_positive", "answered_negative", "unknown", "conflicting"]),
    claimIds: z.array(z.string().min(1)),
    evidenceIds: z.array(z.string().min(1)),
    conciseAnswer: z.string().min(1),
  })
  .strict();

const factorSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    definition: z.string().min(1),
    purposes: z.array(
      z.enum([
        "fit",
        "commercial_potential",
        "confidence",
        "eligibility",
        "relationship",
      ]),
    ),
    weight: z.number().nonnegative(),
    criticality: z.enum(["required", "important", "supporting"]),
    unknownPolicy: z.enum([
      "reduce_confidence_only",
      "requires_research_if_required",
      "not_applicable_when_unresolved",
    ]),
    positiveDefinition: z.string().min(1),
    negativeDefinition: z.string().min(1),
    acceptedEvidenceTypes: z.array(z.string().min(1)),
  })
  .strict();

const rubricSchema = z
  .object({
    desiredRelationships: z.array(z.string().min(1)),
    normallyExcludedRelationships: z.array(z.string().min(1)),
    factors: z.array(factorSchema),
    hardExclusionRules: z.array(z.unknown()),
    thresholds: z
      .object({
        minimumEvidenceCoverage: z.number().min(0).max(1),
        minimumConfidenceForRecommended: z.number().min(0).max(100),
        minimumFitForRecommended: z.number().min(0).max(100),
        minimumFitForConditional: z.number().min(0).max(100),
        rejectBelowFit: z.number().min(0).max(100),
      })
      .strict(),
    factorLibraryVersion: z.string().min(1),
    scoringPolicyVersion: z.string().min(1),
    relationshipClassifierVersion: z.string().min(1),
    exclusionPolicyVersion: z.string().min(1),
    contentHash: z.string().length(64),
  })
  .strict();

const cachedOutputSchema = z
  .object({
    taskType: z.enum(["relationship", "factors"]),
    requestHash: z.string().length(64),
    output: z.unknown(),
    aiRequestId: z.string().min(1),
  })
  .strict();

const memberContextSchema = z
  .object({
    schemaVersion: z.literal(2),
    batchId: z.string().min(1),
    memberId: z.string().min(1),
    workspaceId: z.string().min(1),
    campaignRunId: z.string().min(1),
    campaignId: z.string().min(1),
    strategyVersionId: z.string().min(1),
    campaignCandidateId: z.string().min(1),
    evaluationVersionId: z.string().min(1),
    candidateIntelligenceVersionId: z.string().min(1),
    inputHash: z.string().length(64),
    status: z.string().min(1),
    objective: z.unknown(),
    organization: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        organizationType: z.string().min(1),
        operatingStatus: z.string().min(1),
        identityConfidence: z.number().min(0).max(1),
        identityReviewState: z.string().min(1),
      })
      .strict(),
    candidateState: z.string().min(1),
    validEntity: z.boolean(),
    merged: z.boolean(),
    procurementAutonomy: z.string().nullable(),
    procurementConfidence: z.number().min(0).max(1),
    procurementCritical: z.boolean(),
    rubric: rubricSchema,
    claims: z.array(claimSchema),
    evidence: z.array(evidenceSchema),
    questionFindings: z.array(questionFindingSchema),
    cachedOutputs: z.array(cachedOutputSchema),
    outputReference: z.unknown().nullable(),
  })
  .strict();

const savedOutputSchema = z
  .object({
    taskType: z.enum(["relationship", "factors"]),
    requestHash: z.string().length(64),
    output: z.unknown(),
    aiRequestId: z.string().min(1),
  })
  .strict();

const memberResultSchema = z
  .object({
    schemaVersion: z.literal(2),
    memberId: z.string().min(1),
    campaignCandidateId: z.string().min(1),
    evaluationVersionId: z.string().min(1),
    status: z.enum(["completed", "blocked"]),
    eligibility: z.string().min(1).nullable(),
    lane: z.string().min(1).nullable(),
    fitScore: z.number().int().min(0).max(100).nullable(),
    potentialScore: z.number().int().min(0).max(100).nullable(),
    confidence: z.number().int().min(0).max(100).nullable(),
    aiRequestIds: z.array(z.string().min(1)),
    cached: z.boolean(),
  })
  .strict();

const qualificationSummarySchema = z
  .object({
    schemaVersion: z.literal(2),
    batchId: z.string().min(1),
    campaignRunId: z.string().min(1),
    status: z.enum(["completed", "partial"]),
    candidateCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    evaluationVersionIds: z.array(z.string().min(1)),
    aiRequestIds: z.array(z.string().min(1)),
    laneCounts: z.record(z.string(), z.number().int().nonnegative()),
  })
  .strict();

export type CampaignQualificationContext = z.infer<typeof qualificationContextSchema>;
export type QualificationBatch = z.infer<typeof qualificationBatchSchema>;
export type QualificationMemberContext = Omit<
  z.infer<typeof memberContextSchema>,
  "rubric" | "claims" | "evidence"
> & {
  rubric: QualificationRubricRuntime;
  claims: QualificationClaim[];
  evidence: QualificationEvidence[];
};
export type QualificationMemberResult = z.infer<typeof memberResultSchema>;

export async function loadCampaignQualificationContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  return qualificationContextSchema.parse(
    await rpc("load_campaign_qualification_inputs_v2", {
      target_campaign_run_id: input.campaignRunId,
      target_workspace_id: input.workspaceId,
    }),
  );
}

export async function initializeQualificationBatch(input: {
  campaignRunId: string;
  workspaceId: string;
  contractVersion: string;
  inputHash: string;
  rubric: Json;
  candidates: Json;
}) {
  return qualificationBatchSchema.parse(
    await rpc("initialize_candidate_qualification_batch_v2", {
      target_campaign_run_id: input.campaignRunId,
      target_workspace_id: input.workspaceId,
      target_contract_version: input.contractVersion,
      target_input_hash: input.inputHash,
      target_rubric: input.rubric,
      target_candidates: input.candidates,
    }),
  );
}

export async function claimQualificationMember(input: {
  memberId: string;
  triggerRunId: string;
  workspaceId: string;
}) {
  const parsed = memberContextSchema.parse(
    await rpc("claim_candidate_qualification_member_v2", {
      target_member_id: input.memberId,
      target_trigger_run_id: input.triggerRunId,
      target_workspace_id: input.workspaceId,
    }),
  );
  return parsed as QualificationMemberContext;
}

export async function saveQualificationAiOutput(input: {
  memberId: string;
  workspaceId: string;
  taskType: "relationship" | "factors";
  requestHash: string;
  output: Json;
  modelCall: AiCallResult<string>;
  startedAt: string;
}) {
  return savedOutputSchema.parse(
    await rpc("save_candidate_qualification_ai_output_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
      target_task_type: input.taskType,
      target_request_hash: input.requestHash,
      target_output: input.output,
      target_ai_request: {
        provider: input.modelCall.provider,
        requestedModel: input.modelCall.requestedModel,
        actualModel: input.modelCall.actualModel ?? input.modelCall.requestedModel,
        fallbackUsed: input.modelCall.fallbackUsed,
        fallbackReason: input.modelCall.fallbackReason ?? null,
        inputTokens: input.modelCall.inputTokens ?? null,
        outputTokens: input.modelCall.outputTokens ?? null,
        providerRequestId: input.modelCall.providerRequestId ?? null,
        actualCost: input.modelCall.providerReportedCost ?? 0,
        currency: input.modelCall.providerCurrency ?? "USD",
        latencyMs: input.modelCall.latencyMs,
        startedAt: input.startedAt,
      } as Json,
    }),
  );
}

export async function completeQualificationMember(input: {
  memberId: string;
  workspaceId: string;
  relationshipRequestHash: string;
  factorRequestHash: string;
  relationship: Json;
  exclusions: Json;
  factors: Json;
  fit: Json;
  potential: Json;
  confidence: Json;
  eligibility: Json;
  lane: Json;
  explanation: string;
  aiRequestIds: Json;
  finalSnapshot: Json;
}) {
  return memberResultSchema.parse(
    await rpc("complete_candidate_qualification_member_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
      target_relationship_request_hash: input.relationshipRequestHash,
      target_factor_request_hash: input.factorRequestHash,
      target_relationship: input.relationship,
      target_exclusions: input.exclusions,
      target_factors: input.factors,
      target_fit: input.fit,
      target_potential: input.potential,
      target_confidence: input.confidence,
      target_eligibility: input.eligibility,
      target_lane: input.lane,
      target_explanation: input.explanation,
      target_ai_request_ids: input.aiRequestIds,
      target_final_snapshot: input.finalSnapshot,
    }),
  );
}

export async function blockQualificationMember(input: {
  memberId: string;
  workspaceId: string;
  errorCode: string;
  errorMessage: string;
}) {
  return memberResultSchema.parse(
    await rpc("block_candidate_qualification_member_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
      target_error_code: input.errorCode,
      target_error_message: input.errorMessage.slice(0, 1_000),
    }),
  );
}

export async function finalizeQualificationBatch(input: {
  batchId: string;
  workspaceId: string;
}) {
  return qualificationSummarySchema.parse(
    await rpc("finalize_candidate_qualification_batch_v2", {
      target_batch_id: input.batchId,
      target_workspace_id: input.workspaceId,
    }),
  );
}

export function parseQualificationMemberResult(value: unknown) {
  return memberResultSchema.parse(value);
}

export function qualificationFactorDefinitions(
  member: QualificationMemberContext,
): RuntimeQualificationFactor[] {
  return member.rubric.factors;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`Qualification V2 persistence failed: ${error.message}`);
  return data;
}
