import { randomUUID } from "node:crypto";
import { parseCompleteJsonObject } from "@/lib/ai/structured-json";
import {
  buildCandidateEvidenceExtractionMessages,
  compileCandidateClaims,
  freshnessClassForQuestion,
  normalizeCandidateEvidenceExtraction,
  type CandidateEvidenceExtraction,
  type CandidateResearchQuestion,
} from "@/lib/candidate-intelligence-v2";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { generateTextResult } from "@/lib/providers/openrouter";
import type { Json } from "@/types/database.types";
import {
  claimCandidateResearchMember,
  completeCandidateResearchMember,
  findCandidateResearchExtraction,
  parseCandidateResearchMemberResult,
  saveCandidateResearchExtraction,
  type CandidateResearchMemberContext,
} from "./repository";
import { collectCandidateResearchSources } from "./source-service";

const promptVersion = "candidate-evidence-extraction-v2.1";
const schemaVersion = "candidate-evidence-extraction-v2.1";

export async function executeCandidateResearchMember(input: {
  memberId: string;
  triggerRunId: string;
  workspaceId: string;
}) {
  const member = await claimCandidateResearchMember(input);
  if (member.status === "completed" || member.status === "blocked") {
    return parseCandidateResearchMemberResult(member.outputReference);
  }

  const { sources, warnings } = await collectCandidateResearchSources(member);
  const evidenceContext = sources.map((source) => ({
    evidenceId: source.evidenceId,
    sourceUrl: source.sourceUrl,
    pageKind: source.pageKind,
    retrievedAt: source.retrievedAt,
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
      const messages = buildCandidateEvidenceExtractionMessages({
        organization: {
          id: member.organizationId,
          name: member.organizationName,
          organizationType: member.organizationType,
          canonicalDomain: member.canonicalDomain,
        },
        campaign: member.strategyContext,
        plan: member.plan,
        evidence: evidenceContext,
      });
      const startedAt = new Date().toISOString();
      const modelCall = await generateTextResult(messages, {
        role: "website_extraction",
        jsonMode: true,
        maxCompletionTokens: 5_000,
        reasoningEffort: "minimal",
        taskName: "V2 candidate evidence extraction",
      });
      extraction = normalizeCandidateEvidenceExtraction({
        raw: parseCompleteJsonObject(modelCall.data),
        plan: member.plan,
        evidence: evidenceContext,
      });
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

  const persisted = preparePersistedResearch(member, extraction);
  return completeCandidateResearchMember({
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
}

function preparePersistedResearch(
  member: CandidateResearchMemberContext,
  extraction: CandidateEvidenceExtraction,
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
  const claims = compiledClaims.map((claim) => {
    const question = requiredQuestion(questionByKey, claim.key);
    return {
      id: randomUUID(),
      ...claim,
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

function requiredQuestion(values: Map<string, CandidateResearchQuestion>, key: string) {
  const question = values.get(key);
  if (!question) {
    throw new Error(`Candidate research question "${key}" is not frozen in the plan.`);
  }
  return question;
}
