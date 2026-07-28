import {
  QUALIFICATION_RUNTIME_CONTRACT_VERSION,
  compileQualificationRubric,
  prepareQualificationCandidates,
} from "@/lib/qualification-v2";
import {
  campaignStrategyV2Schema,
  hashCanonical,
} from "@/lib/intelligence/campaign-strategy-v2";
import type { StageResult } from "@/lib/workflow-v2";
import type { Json } from "@/types/database.types";
import {
  finalizeQualificationBatch,
  initializeQualificationBatch,
  loadCampaignQualificationContext,
} from "./repository";

export async function prepareQualificationStage(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const context = await loadCampaignQualificationContext(input);
  const strategy = campaignStrategyV2Schema.parse(context.strategy);
  if (
    strategy.id !== context.strategyVersionId ||
    strategy.campaignId !== context.campaignId ||
    strategy.status !== "confirmed"
  ) {
    throw new Error("Qualification requires the run's frozen confirmed Strategy.");
  }
  const rubric = compileQualificationRubric(strategy);
  const candidates = prepareQualificationCandidates({
    campaignRunId: context.campaignRunId,
    rubric,
    candidates: context.candidates,
  });
  const inputHash = hashCanonical({
    campaignRunId: context.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    researchBatchId: context.researchBatchId,
    rubricContentHash: rubric.contentHash,
    candidates,
    contractVersion: QUALIFICATION_RUNTIME_CONTRACT_VERSION,
  });
  return initializeQualificationBatch({
    campaignRunId: context.campaignRunId,
    workspaceId: input.workspaceId,
    contractVersion: QUALIFICATION_RUNTIME_CONTRACT_VERSION,
    inputHash,
    rubric: rubric as unknown as Json,
    candidates: candidates as unknown as Json,
  });
}

export async function finalizeQualificationStage(input: {
  batchId: string;
  workspaceId: string;
}): Promise<StageResult> {
  const summary = await finalizeQualificationBatch(input);
  return {
    stage: "qualify_candidates",
    status: summary.blockedCount > 0 ? "partial" : "completed",
    outputReferences: {
      ...summary,
      stageScope: "relationship_first_evidence_factor_qualification",
    },
    progressDelta: {
      candidatesQualified: summary.completedCount,
      candidateQualificationBlocked: summary.blockedCount,
      qualificationRecommended: summary.laneCounts.recommended ?? 0,
      qualificationConditional: summary.laneCounts.conditional ?? 0,
      qualificationRequiresResearch: summary.laneCounts.requires_research ?? 0,
      qualificationRejected: summary.laneCounts.rejected ?? 0,
      qualificationExcluded: summary.laneCounts.excluded ?? 0,
    },
    usageEventIds: summary.aiRequestIds,
  };
}
