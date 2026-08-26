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
  bindQualificationRelationshipAssessments,
  initializeQualificationBatch,
  loadCampaignQualificationContext,
} from "./repository";
import { prepareSemanticDiscoveryContext } from "@/server/discovery-v2/semantic-context";
import { ensureCompanyIntelligenceForCandidateSource } from "@/server/core-intelligence-v2/company-intelligence-service";
import { compileAndPersistCommercialRelationshipAssessment } from "@/server/core-intelligence-v2/commercial-relationship-service";
import { loadCampaignResearchContext } from "@/server/candidate-research-v2/repository";
import { loadMarketResearchPlanForDiscovery } from "@/server/discovery-v2/plan-discovery";

export async function prepareQualificationStage(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
}) {
  const [context, semanticContext, researchContext] = await Promise.all([
    loadCampaignQualificationContext(input),
    prepareSemanticDiscoveryContext(input),
    loadCampaignResearchContext(input),
  ]);
  const strategy = campaignStrategyV2Schema.parse(semanticContext.strategy);
  if (strategy.id !== context.strategyVersionId || strategy.status !== "confirmed") {
    throw new Error("Qualification requires the run's frozen confirmed Strategy.");
  }
  const rubric = compileQualificationRubric(strategy);
  const marketResearchPlan = await loadMarketResearchPlanForDiscovery({
    workspaceId: input.workspaceId,
    campaignId: context.campaignId,
    campaignRunId: context.campaignRunId,
    runCreatedAt: semanticContext.campaignRunCreatedAt,
  });
  const researchCandidateById = new Map(
    researchContext.candidates.map((candidate) => [
      candidate.campaignCandidateId,
      candidate,
    ]),
  );
  const candidatesWithCompanyIntelligence = await Promise.all(
    context.candidates.map(async (candidate) => {
      const companyIntelligence = await ensureCompanyIntelligenceForCandidateSource({
        workspaceId: input.workspaceId,
        sourceCandidateIntelligenceVersionId: candidate.candidateIntelligenceVersionId,
      });
      const researchCandidate = researchCandidateById.get(candidate.campaignCandidateId);
      const relationshipAssessment =
        companyIntelligence && marketResearchPlan && researchCandidate
          ? await compileAndPersistCommercialRelationshipAssessment({
              workspaceId: input.workspaceId,
              campaignId: context.campaignId,
              companyIntelligenceVersionId: companyIntelligence.id,
              campaignTargetModelVersionId:
                marketResearchPlan.campaignTargetModelVersionId,
              matchedArchetypeIds: researchCandidate.matchedArchetypeIds,
            })
          : null;
      return {
        ...candidate,
        ...(companyIntelligence
          ? {
              companyIntelligenceVersionId: companyIntelligence.id,
              companyIntelligenceContentHash:
                companyIntelligence.artifact.version.contentHash,
            }
          : {}),
        ...(relationshipAssessment
          ? {
              commercialRelationshipAssessmentVersionId: relationshipAssessment.id,
              commercialRelationshipAssessmentContentHash:
                relationshipAssessment.artifact.version.contentHash,
            }
          : {}),
      };
    }),
  );
  const candidates = prepareQualificationCandidates({
    campaignRunId: context.campaignRunId,
    rubric,
    candidates: candidatesWithCompanyIntelligence,
  });
  const inputHash = hashCanonical({
    campaignRunId: context.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    researchBatchId: context.researchBatchId,
    rubricContentHash: rubric.contentHash,
    candidates,
    contractVersion: QUALIFICATION_RUNTIME_CONTRACT_VERSION,
  });
  const batch = await initializeQualificationBatch({
    campaignRunId: context.campaignRunId,
    workspaceId: input.workspaceId,
    contractVersion: QUALIFICATION_RUNTIME_CONTRACT_VERSION,
    inputHash,
    rubric: rubric as unknown as Json,
    candidates: candidates as unknown as Json,
  });
  await bindQualificationRelationshipAssessments({
    batchId: batch.batchId,
    workspaceId: input.workspaceId,
    bindings: candidates.flatMap((candidate) =>
      candidate.commercialRelationshipAssessmentVersionId
        ? [
            {
              campaignCandidateId: candidate.campaignCandidateId,
              assessmentVersionId: candidate.commercialRelationshipAssessmentVersionId,
            },
          ]
        : [],
    ),
  });
  return batch;
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
