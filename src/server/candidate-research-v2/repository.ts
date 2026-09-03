import { z } from "zod";
import type { AiCallResult } from "@/lib/providers/openrouter";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const claimStateSchema = z
  .object({
    key: z.string().min(1),
    epistemicStatus: z.enum([
      "explicit_fact",
      "evidence_backed_inference",
      "hypothesis",
      "unknown",
      "conflict",
    ]),
    freshnessState: z.enum(["current", "acceptable", "stale", "unknown"]),
    reusableStatus: z.enum(["active", "conflicting", "superseded", "rejected"]),
    reusableScope: z.enum(["organization", "offering_context", "campaign_only"]),
  })
  .strict();

const campaignResearchCandidateSchema = z
  .object({
    campaignCandidateId: z.string().min(1),
    organizationId: z.string().min(1),
    organizationName: z.string().min(1),
    organizationType: z.string().min(1),
    canonicalDomain: z.string().nullable(),
    canonicalUrl: z.string().nullable(),
    procurementAutonomy: z.string().nullable(),
    matchedArchetypeIds: z.array(z.string().min(1)),
    discoverySourceIds: z.array(z.string().min(1)),
    currentIntelligenceVersionId: z.string().nullable(),
    unresolvedQuestionKeys: z.array(z.string().min(1)),
    conflictKeys: z.array(z.string().min(1)),
    claimStates: z.array(claimStateSchema),
  })
  .strict();

const campaignResearchContextSchema = z
  .object({
    schemaVersion: z.literal(2),
    campaignRunId: z.string().min(1),
    campaignId: z.string().min(1),
    strategyVersionId: z.string().min(1),
    strategy: z.unknown(),
    candidates: z.array(campaignResearchCandidateSchema),
  })
  .strict();

const researchBatchSchema = z
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

const researchQuestionSchema = z
  .object({
    id: z.string().min(1),
    key: z.string().min(1),
    question: z.string().min(1),
    purpose: z.enum([
      "identity",
      "business_model",
      "relationship",
      "eligibility",
      "qualification_factor",
      "commercial_potential",
      "procurement",
      "freshness",
      "conflict_resolution",
    ]),
    required: z.boolean(),
    priority: z.number(),
    reusableScope: z.enum(["organization", "offering_context", "campaign_only"]),
    expectedEvidenceTypes: z.array(
      z.enum([
        "official_web_page",
        "official_document",
        "legal_registry",
        "company_database",
        "directory_profile",
        "news_article",
        "job_posting",
        "social_company_profile",
        "map_listing",
        "marketplace_profile",
        "user_input",
        "system_observation",
      ]),
    ),
  })
  .strict();

const websitePageKindSchema = z.enum([
  "home",
  "about",
  "products_services",
  "brands_partners",
  "locations",
  "legal",
  "supplier_procurement",
  "careers",
  "investor_relations",
  "news",
  "contact",
  "wholesale_b2b",
]);

const researchPlanSchema = z
  .object({
    organizationId: z.string().min(1),
    campaignCandidateId: z.string().min(1).optional(),
    strategyVersionId: z.string().min(1).optional(),
    researchType: z.enum(["reusable", "campaign_specific"]),
    researchBlueprintVersionIds: z.array(z.string().min(1)).optional(),
    questions: z.array(researchQuestionSchema).max(12),
    preferredPages: z.array(websitePageKindSchema),
    pageBudget: z.number().int().positive(),
    stopPolicy: z
      .object({
        stopWhenRequiredQuestionsResolved: z.boolean(),
        minimumEvidenceQuality: z.enum(["authoritative", "strong", "supporting"]),
        maximumPages: z.number().int().positive(),
        maximumRuntimeSeconds: z.number().int().positive(),
      })
      .strict(),
  })
  .strict();

const sourcePlanSchema = z
  .object({
    canonicalDomain: z.string().nullable(),
    canonicalUrl: z.string().nullable(),
    discoverySourceIds: z.array(z.string().min(1)),
    preferredPages: z.array(websitePageKindSchema),
    maximumDiscoverySources: z.number().int().positive(),
    maximumFirstPartyFetches: z.number().int().nonnegative(),
    deferredQuestionKeys: z.array(z.string().min(1)),
    deferredReusableQuestionKeys: z.array(z.string().min(1)),
    prioritization: z
      .object({
        version: z.literal("candidate-priority-v1"),
        score: z.number().min(0).max(100),
        signals: z.array(
          z
            .object({
              key: z.string().min(1),
              contribution: z.number(),
              explanation: z.string().min(1),
            })
            .strict(),
        ),
      })
      .strict()
      .optional(),
  })
  .strict();

const discoverySourceSchema = z
  .object({
    providerSourceRecordId: z.string().min(1),
    providerExecutionId: z.string().min(1),
    sourceUrl: z.string().nullable(),
    retrievedAt: z.iso.datetime({ offset: true }),
    rawPayload: z.unknown(),
  })
  .strict();

const persistedSourceSchema = z
  .object({
    artifactId: z.string().min(1),
    evidenceId: z.string().min(1),
    sourceKind: z.enum(["discovery", "first_party_fetch"]),
    sourceUrl: z.string().min(1),
    pageKind: z.string().min(1),
    retrievedAt: z.iso.datetime({ offset: true }),
    contentHash: z.string().length(64),
    content: z.string(),
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
    organizationId: z.string().min(1),
    organizationName: z.string().min(1),
    organizationType: z.string().min(1),
    canonicalDomain: z.string().nullable(),
    canonicalUrl: z.string().nullable(),
    inputHash: z.string().length(64),
    status: z.string().min(1),
    researchPlanId: z.string().min(1),
    plan: researchPlanSchema,
    sourcePlan: sourcePlanSchema,
    strategyContext: z
      .object({
        objective: z.unknown(),
        matchedArchetypes: z.array(z.unknown()),
        qualificationFactors: z.array(z.unknown()),
        hardExclusionRules: z.array(z.unknown()),
      })
      .strict(),
    discoverySources: z.array(discoverySourceSchema),
    persistedSources: z.array(persistedSourceSchema),
    outputReference: z.unknown().nullable(),
  })
  .strict();

const extractionCacheSchema = z
  .object({
    output: z.unknown(),
    aiRequestId: z.string().min(1),
  })
  .strict();

const memberResultSchema = z
  .object({
    schemaVersion: z.literal(2),
    memberId: z.string().min(1),
    campaignCandidateId: z.string().min(1),
    status: z.enum(["completed", "blocked"]),
    intelligenceVersionId: z.string().min(1),
    claimCount: z.number().int().nonnegative(),
    evidenceCount: z.number().int().nonnegative(),
    unresolvedQuestionCount: z.number().int().nonnegative(),
    aiRequestIds: z.array(z.string().min(1)),
    cached: z.boolean(),
  })
  .strict();

const researchSummarySchema = z
  .object({
    schemaVersion: z.literal(2),
    batchId: z.string().min(1),
    campaignRunId: z.string().min(1),
    status: z.enum(["completed", "partial"]),
    candidateCount: z.number().int().nonnegative(),
    completedCount: z.number().int().nonnegative(),
    blockedCount: z.number().int().nonnegative(),
    evidenceCount: z.number().int().nonnegative(),
    claimCount: z.number().int().nonnegative(),
    unresolvedQuestionCount: z.number().int().nonnegative(),
    intelligenceVersionIds: z.array(z.string().min(1)),
    aiRequestIds: z.array(z.string().min(1)),
  })
  .strict();

export type CampaignResearchContext = z.infer<typeof campaignResearchContextSchema>;
export type CandidateResearchBatch = z.infer<typeof researchBatchSchema>;
export type CandidateResearchMemberContext = z.infer<typeof memberContextSchema>;
export type CandidateResearchSource = z.infer<typeof persistedSourceSchema>;
export type CandidateResearchMemberResult = z.infer<typeof memberResultSchema>;
export type CandidateResearchSummary = z.infer<typeof researchSummarySchema>;

export async function loadCampaignResearchContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  return campaignResearchContextSchema.parse(
    await rpc("load_campaign_candidate_research_inputs_v2", {
      target_campaign_run_id: input.campaignRunId,
      target_workspace_id: input.workspaceId,
    }),
  );
}

export async function findCandidateResearchBatch(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
}) {
  const supabase = createServiceRoleClient();
  const { data: cycle, error: cycleError } = await supabase
    .from("campaign_research_cycles_v2")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .eq("cycle_number", input.cycleNumber ?? 1)
    .maybeSingle();
  if (cycleError)
    throw new Error(`Could not inspect the research cycle: ${cycleError.message}`);
  if (!cycle) return null;
  const { data: batch, error: batchError } = await supabase
    .from("candidate_research_batches_v2")
    .select("id,campaign_run_id,contract_version,input_hash,status,candidate_count")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .eq("research_cycle_id", cycle.id)
    .maybeSingle();
  if (batchError) {
    throw new Error(
      `Could not inspect the frozen Candidate research batch: ${batchError.message}`,
    );
  }
  if (!batch) return null;

  const { data: members, error: memberError } = await supabase
    .from("candidate_research_batch_members_v2")
    .select("id,status,attempt_count,research_plan_id")
    .eq("workspace_id", input.workspaceId)
    .eq("candidate_research_batch_id", batch.id)
    .order("id");
  if (memberError) {
    throw new Error(
      `Could not inspect frozen Candidate research members: ${memberError.message}`,
    );
  }
  const planIds = members.map(({ research_plan_id: planId }) => planId);
  const { data: plans, error: planError } = planIds.length
    ? await supabase
        .from("candidate_research_plans")
        .select("id,priority")
        .eq("workspace_id", input.workspaceId)
        .in("id", planIds)
    : { data: [], error: null };
  if (planError) {
    throw new Error(
      `Could not inspect Candidate research priorities: ${planError.message}`,
    );
  }
  const priorityByPlanId = new Map(plans.map(({ id, priority }) => [id, priority]));
  const orderedMembers = [...members].sort(
    (left, right) =>
      (priorityByPlanId.get(right.research_plan_id) ?? 0) -
        (priorityByPlanId.get(left.research_plan_id) ?? 0) ||
      left.id.localeCompare(right.id),
  );

  return researchBatchSchema.parse({
    schemaVersion: 2,
    batchId: batch.id,
    campaignRunId: batch.campaign_run_id,
    contractVersion: batch.contract_version,
    inputHash: batch.input_hash,
    status: batch.status,
    candidateCount: batch.candidate_count,
    memberIds: orderedMembers.map(({ id }) => id),
    pendingMemberIds: orderedMembers
      .filter(({ status }) => ["queued", "running"].includes(status))
      .map(({ id }) => id),
    reusedMemberCount: orderedMembers.filter(
      ({ status, attempt_count: attempts }) => status === "completed" && attempts === 0,
    ).length,
  });
}

export async function initializeCandidateResearchBatch(input: {
  campaignRunId: string;
  workspaceId: string;
  contractVersion: string;
  inputHash: string;
  plans: Json;
}) {
  return researchBatchSchema.parse(
    await rpc("initialize_candidate_research_batch_v2", {
      target_campaign_run_id: input.campaignRunId,
      target_workspace_id: input.workspaceId,
      target_contract_version: input.contractVersion,
      target_input_hash: input.inputHash,
      target_plans: input.plans,
    }),
  );
}

export async function claimCandidateResearchMember(input: {
  memberId: string;
  triggerRunId: string;
  workspaceId: string;
}) {
  return memberContextSchema.parse(
    await rpc("claim_candidate_research_member_v2", {
      target_member_id: input.memberId,
      target_trigger_run_id: input.triggerRunId,
      target_workspace_id: input.workspaceId,
    }),
  );
}

export async function persistCandidateResearchSource(input: {
  workspaceId: string;
  memberId: string;
  sourceKind: "discovery" | "first_party_fetch";
  providerSourceRecordId?: string;
  sourceUrl: string;
  pageKind: string;
  content: string;
  contentHash: string;
  retrievedAt: string;
}) {
  return persistedSourceSchema.parse(
    await rpc("persist_candidate_research_source_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
      target_source_kind: input.sourceKind,
      target_provider_source_record_id: input.providerSourceRecordId ?? null,
      target_source_url: input.sourceUrl,
      target_page_kind: input.pageKind,
      target_content: input.content,
      target_content_hash: input.contentHash,
      target_retrieved_at: input.retrievedAt,
    }),
  );
}

export async function findCandidateResearchExtraction(input: {
  planId: string;
  requestHash: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("candidate_research_tasks")
    .select("result_reference_json")
    .eq("workspace_id", input.workspaceId)
    .eq("research_plan_id", input.planId)
    .eq("task_type", "extract_claims")
    .eq("idempotency_key", `extract:${input.requestHash}`)
    .eq("status", "completed")
    .maybeSingle();
  if (error)
    throw new Error(`Could not inspect Candidate research extraction: ${error.message}`);
  return data?.result_reference_json
    ? extractionCacheSchema.parse(data.result_reference_json)
    : null;
}

export async function saveCandidateResearchExtraction(input: {
  memberId: string;
  workspaceId: string;
  requestHash: string;
  output: Json;
  modelCall: AiCallResult<string>;
  startedAt: string;
}) {
  return extractionCacheSchema.parse(
    await rpc("save_candidate_research_extraction_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
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

export async function completeCandidateResearchMember(input: {
  memberId: string;
  workspaceId: string;
  extractionRequestHash: string;
  claims: Json;
  questionFindings: Json;
  missingEvidence: Json;
  evidenceIds: Json;
  aiRequestIds: Json;
  accessBlocked: boolean;
}) {
  return memberResultSchema.parse(
    await rpc("complete_candidate_research_member_v2", {
      target_workspace_id: input.workspaceId,
      target_member_id: input.memberId,
      target_extraction_request_hash: input.extractionRequestHash,
      target_claims: input.claims,
      target_question_findings: input.questionFindings,
      target_missing_evidence: input.missingEvidence,
      target_evidence_ids: input.evidenceIds,
      target_ai_request_ids: input.aiRequestIds,
      target_access_blocked: input.accessBlocked,
    }),
  );
}

export async function blockCandidateResearchMember(input: {
  memberId: string;
  workspaceId: string;
  errorCode: string;
  errorMessage: string;
}) {
  await rpc("block_candidate_research_member_v2", {
    target_workspace_id: input.workspaceId,
    target_member_id: input.memberId,
    target_error_code: input.errorCode,
    target_error_message: input.errorMessage,
  });
}

export async function finalizeCandidateResearchBatch(input: {
  batchId: string;
  workspaceId: string;
}) {
  return researchSummarySchema.parse(
    await rpc("finalize_candidate_research_batch_v2", {
      target_batch_id: input.batchId,
      target_workspace_id: input.workspaceId,
    }),
  );
}

export function parseCandidateResearchMemberResult(value: unknown) {
  return memberResultSchema.parse(value);
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error)
    throw new Error(`Candidate Research V2 persistence failed: ${error.message}`);
  return data;
}
