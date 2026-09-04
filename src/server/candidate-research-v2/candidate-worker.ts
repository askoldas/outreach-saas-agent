import { randomUUID } from "node:crypto";
import {
  candidateEvidenceExtractionPromptVersion,
  candidateEvidenceExtractionSchemaVersion,
  candidateEvidenceExtractionTaskDefinition,
  compileCandidateClaims,
  freshnessClassForQuestion,
  normalizeCandidateEvidenceExtraction,
  type CandidateEvidenceExtraction,
  type CandidateResearchQuestion,
} from "@/lib/candidate-intelligence-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { assertIntelligenceExternalCallsAllowed } from "@/lib/intelligence/external-call-controls";
import { generateTextResult } from "@/lib/providers/openrouter";
import { executeValidatedAiTask } from "@/lib/intelligence/runtime/execute-ai-task";
import { IntelligenceTaskRegistry } from "@/lib/intelligence/runtime/task-registry";
import { IntelligenceSchemaRegistry } from "@/lib/intelligence/runtime/schema-registry";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";
import { runBudgetedOpenRouterCall } from "@/server/credits/budgeted-provider-call";
import type { Json } from "@/types/database.types";
import {
  claimCandidateResearchMember,
  completeCandidateResearchMember,
  findCandidateResearchExtraction,
  loadPersistedCandidateSupportingSources,
  parseCandidateResearchMemberResult,
  saveCandidateResearchExtraction,
  type CandidateResearchMemberContext,
} from "./repository";
import { collectCandidateResearchSources } from "./source-service";
import {
  compileAndPersistCompanyIntelligence,
  ensureCompanyIntelligenceForCandidateSource,
} from "@/server/core-intelligence-v2/company-intelligence-service";

const promptVersion = candidateEvidenceExtractionPromptVersion;
const schemaVersion = candidateEvidenceExtractionSchemaVersion;

export async function executeCandidateResearchMember(input: {
  memberId: string;
  triggerRunId: string;
  workspaceId: string;
}) {
  const claimedMember = await claimCandidateResearchMember(input);
  if (claimedMember.status === "completed" || claimedMember.status === "blocked") {
    const completed = parseCandidateResearchMemberResult(claimedMember.outputReference);
    await ensureCompanyIntelligenceForCandidateSource({
      workspaceId: input.workspaceId,
      sourceCandidateIntelligenceVersionId: completed.intelligenceVersionId,
    });
    return completed;
  }
  const supportingSources = await loadPersistedCandidateSupportingSources({
    workspaceId: input.workspaceId,
    memberId: claimedMember.memberId,
  });
  const member = {
    ...claimedMember,
    persistedSources: [
      ...claimedMember.persistedSources,
      ...supportingSources.filter(
        ({ evidenceId }) =>
          !claimedMember.persistedSources.some(
            (source) => source.evidenceId === evidenceId,
          ),
      ),
    ],
  };

  const { sources, warnings } = await collectCandidateResearchSources(member);
  const evidenceContext = sources.map((source) => ({
    evidenceId: source.evidenceId,
    sourceUrl: source.sourceUrl,
    pageKind: source.pageKind,
    retrievedAt: source.retrievedAt,
    ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}),
    content: source.content,
  }));
  const extractionRequestHash = hashCanonical({
    memberInputHash: member.inputHash,
    promptVersion,
    schemaVersion,
    sourceHashes: sources.map(({ contentHash, evidenceId }) => ({
      contentHash,
      evidenceId,
    })),
  });

  let extraction: CandidateEvidenceExtraction;
  let aiRequestIds: string[] = [];
  if (sources.length === 0) {
    extraction = normalizeCandidateEvidenceExtraction({
      raw: {
        claims: [],
        questionFindings: [],
        missingEvidence: [
          ...warnings,
          "No reusable or accessible first-party evidence was available.",
        ],
      },
      plan: member.plan,
      evidence: [],
    });
  } else {
    const cached = await findCandidateResearchExtraction({
      planId: member.researchPlanId,
      requestHash: extractionRequestHash,
      workspaceId: input.workspaceId,
    });
    if (cached) {
      extraction = normalizeCandidateEvidenceExtraction({
        raw: cached.output,
        plan: member.plan,
        evidence: evidenceContext,
      });
      aiRequestIds = [cached.aiRequestId];
    } else {
      const request = {
        organization: {
          id: member.organizationId,
          name: member.organizationName,
          organizationType: member.organizationType,
          canonicalDomain: member.canonicalDomain,
        },
        campaign: member.strategyContext,
        plan: member.plan,
        evidence: evidenceContext,
      };
      const startedAt = new Date().toISOString();
      assertIntelligenceExternalCallsAllowed("model");
      const tasks = new IntelligenceTaskRegistry();
      tasks.register(candidateEvidenceExtractionTaskDefinition);
      const schemas = new IntelligenceSchemaRegistry();
      schemas.register({
        taskId: candidateEvidenceExtractionTaskDefinition.taskId,
        schemaVersion: candidateEvidenceExtractionTaskDefinition.schemaVersion,
        schema: candidateEvidenceExtractionTaskDefinition.outputSchema,
        semanticValidators: [],
      });
      const generated = await executeValidatedAiTask<
        typeof request,
        CandidateEvidenceExtraction
      >({
        registry: tasks,
        schemas,
        taskId: candidateEvidenceExtractionTaskDefinition.taskId,
        promptVersion,
        modelRouteVersion: "candidate-research-extraction-route/v1",
        request,
        recordAttempt: createIntelligenceAttemptRecorder({
          workspaceId: input.workspaceId,
          frozenInputHash: extractionRequestHash,
          metadata: {
            memberId: member.memberId,
            researchPlanId: member.researchPlanId,
          },
        }),
        transport: async (transportRequest) => {
          const call = await runBudgetedOpenRouterCall({
            workspaceId: input.workspaceId,
            campaignRunId: member.campaignRunId,
            operation: "company_research_evidence_extraction",
            idempotencyKey: `company-research:${member.memberId}:${extractionRequestHash}`,
            execute: () =>
              generateTextResult(transportRequest.messages, {
                role: "website_extraction",
                maxCompletionTokens: transportRequest.maxCompletionTokens,
                reasoningEffort:
                  transportRequest.reasoningClass === "standard"
                    ? "medium"
                    : transportRequest.reasoningClass,
                taskName: "Company Research evidence extraction",
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
      extraction = normalizeCandidateEvidenceExtraction({
        raw: generated.data,
        plan: member.plan,
        evidence: evidenceContext,
      });
      const modelCall = {
        data: JSON.stringify(generated.data),
        provider: "openrouter" as const,
        requestedModel: generated.provenance.requestedModel,
        actualModel: generated.provenance.actualModel,
        fallbackUsed: generated.provenance.fallbackUsed,
        inputTokens: generated.provenance.inputUnits,
        outputTokens: generated.provenance.outputUnits,
        providerReportedCost: generated.provenance.actualCost,
        providerCurrency:
          generated.provenance.currency === "USD" ? ("USD" as const) : undefined,
        latencyMs: generated.provenance.latencyMs ?? 0,
      };
      const saved = await saveCandidateResearchExtraction({
        memberId: member.memberId,
        workspaceId: input.workspaceId,
        requestHash: extractionRequestHash,
        output: extraction as unknown as Json,
        modelCall,
        startedAt,
      });
      aiRequestIds = [saved.aiRequestId];
    }
  }

  const persisted = preparePersistedResearch(member, extraction, sources);
  const completed = await completeCandidateResearchMember({
    memberId: member.memberId,
    workspaceId: input.workspaceId,
    extractionRequestHash,
    claims: persisted.claims as unknown as Json,
    questionFindings: persisted.questionFindings as unknown as Json,
    missingEvidence: [...new Set([...extraction.missingEvidence, ...warnings])] as Json,
    evidenceIds: sources.map(({ evidenceId }) => evidenceId) as Json,
    aiRequestIds: aiRequestIds as Json,
    accessBlocked: sources.length === 0,
  });
  await compileAndPersistCompanyIntelligence({
    workspaceId: input.workspaceId,
    sourceCandidateIntelligenceVersionId: completed.intelligenceVersionId,
  });
  return completed;
}

function preparePersistedResearch(
  member: CandidateResearchMemberContext,
  extraction: CandidateEvidenceExtraction,
  sources: CandidateResearchMemberContext["persistedSources"],
) {
  const questionByKey = new Map(
    member.plan.questions.map((question) => [question.key, question] as const),
  );
  const compiledClaims = compileCandidateClaims(
    extraction.claims.map((claim) => {
      const question = requiredQuestion(questionByKey, claim.questionKey);
      return {
        key: claim.questionKey,
        fieldPath: claim.fieldPath,
        statement: claim.statement,
        ...(claim.value === undefined ? {} : { value: claim.value }),
        directness: claim.directness,
        confidence: claim.confidence,
        evidenceIds: claim.evidenceIds,
        freshnessClass: freshnessClassForQuestion(question),
        sourceScope: "system_public" as const,
      };
    }),
  );
  const sourceByEvidenceId = new Map(
    sources.map((source) => [source.evidenceId, source] as const),
  );
  const claims = compiledClaims.map((claim) => {
    const question = requiredQuestion(questionByKey, claim.key);
    const observedAt =
      question.purpose === "freshness"
        ? latestPublishedAt(
            claim.evidenceIds.flatMap((id) => {
              const source = sourceByEvidenceId.get(id);
              return source?.publishedAt ? [source.publishedAt] : [];
            }),
          )
        : undefined;
    return {
      id: randomUUID(),
      ...claim,
      ...(observedAt ? { observedAt } : {}),
      reusableScope: question.reusableScope,
    };
  });
  const claimIdsByKey = new Map<string, string[]>();
  for (const claim of claims) {
    claimIdsByKey.set(claim.key, [...(claimIdsByKey.get(claim.key) ?? []), claim.id]);
  }
  const questionFindings = extraction.questionFindings.map((finding) => ({
    ...finding,
    claimIds: [
      ...new Set(finding.claimKeys.flatMap((key) => claimIdsByKey.get(key) ?? [])),
    ].sort(),
  }));
  return { claims, questionFindings };
}

function latestPublishedAt(values: string[]) {
  return [...values].sort().at(-1);
}

function requiredQuestion(values: Map<string, CandidateResearchQuestion>, key: string) {
  const question = values.get(key);
  if (!question) {
    throw new Error(`Candidate research question "${key}" is not frozen in the plan.`);
  }
  return question;
}
