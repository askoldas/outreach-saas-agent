import {
  CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION,
  prepareCampaignTriagePlans,
} from "@/lib/candidate-intelligence-v2";
import {
  campaignStrategyV2Schema,
  hashCanonical,
} from "@/lib/intelligence/campaign-strategy-v2";
import type { StageResult } from "@/lib/workflow-v2";
import type { Json } from "@/types/database.types";
import {
  findCandidateResearchBatch,
  finalizeCandidateResearchBatch,
  initializeCandidateResearchBatch,
  loadCandidateTriageEvidence,
  loadCampaignResearchContext,
  persistCandidateTriageDecisions,
} from "./repository";
import { prepareSemanticDiscoveryContext } from "@/server/discovery-v2/semantic-context";
import { DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS } from "@/lib/research-budget-v2/contracts";
import { loadLatestResearchBlueprints } from "@/server/core-intelligence-v2/repository";
import { loadMarketResearchPlanForDiscovery } from "@/server/discovery-v2/plan-discovery";
import {
  loadPreResearchSuppressionContext,
  matchRelationshipSuppression,
} from "./suppression-context";

export async function prepareCandidateResearchStage(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
}) {
  const frozenBatch = await findCandidateResearchBatch(input);

  const [context, semanticContext] = await Promise.all([
    loadCampaignResearchContext(input),
    prepareSemanticDiscoveryContext(input),
  ]);
  const strategy = campaignStrategyV2Schema.parse(semanticContext.strategy);
  if (strategy.id !== context.strategyVersionId || strategy.status !== "confirmed") {
    throw new Error("Candidate research requires the run's frozen confirmed Strategy.");
  }
  const marketResearchPlan = await loadMarketResearchPlanForDiscovery({
    workspaceId: input.workspaceId,
    campaignId: context.campaignId,
    campaignRunId: context.campaignRunId,
    runCreatedAt: semanticContext.campaignRunCreatedAt,
  });
  const researchBlueprints = marketResearchPlan
    ? await loadLatestResearchBlueprints({
        workspaceId: input.workspaceId,
        campaignId: context.campaignId,
        campaignTargetModelVersionId: marketResearchPlan.campaignTargetModelVersionId,
        marketAnalysisVersionId: marketResearchPlan.marketAnalysisVersionId,
      })
    : [];
  const triageEvidence = await loadCandidateTriageEvidence({
    workspaceId: input.workspaceId,
    campaignCandidateIds: context.candidates.map(
      ({ campaignCandidateId }) => campaignCandidateId,
    ),
  });
  const suppressionContext = await loadPreResearchSuppressionContext({
    workspaceId: input.workspaceId,
    campaignId: context.campaignId,
    rules: strategy.campaignRules,
  });
  const triagePlans = prepareCampaignTriagePlans({
    campaignRunId: context.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    strategy,
    researchBlueprints,
    opportunityLanes: marketResearchPlan?.opportunityLanes,
    candidates: context.candidates.map((candidate) => ({
      ...candidate,
      triageEvidence: triageEvidence.get(candidate.campaignCandidateId),
      relationshipSuppression: matchRelationshipSuppression({
        candidate,
        entries: suppressionContext,
      }),
    })),
  });
  const triageSummary = await persistCandidateTriageDecisions({
    workspaceId: input.workspaceId,
    campaignRunId: context.campaignRunId,
    cycleNumber: input.cycleNumber ?? 1,
    decisions: triagePlans.map((candidatePlan) => ({
      campaignCandidateId: candidatePlan.campaignCandidateId,
      organizationId: candidatePlan.organizationId,
      decision: candidatePlan.sourcePlan.prioritization.lane,
      commercialOpportunityScore: candidatePlan.sourcePlan.prioritization.score,
      components: candidatePlan.sourcePlan.prioritization.signals,
      suppressionReasons: candidatePlan.sourcePlan.prioritization.suppressedReason
        ? [candidatePlan.sourcePlan.prioritization.suppressedReason]
        : [],
      relationshipStatus:
        candidatePlan.sourcePlan.prioritization.relationshipSuppression?.relationship,
      researchDifficulty:
        candidatePlan.sourcePlan.prioritization.researchability.difficulty,
      evidenceIds: [
        ...(candidatePlan.sourcePlan.prioritization.relationshipSuppression
          ?.evidenceIds ?? []),
        ...candidatePlan.sourcePlan.commercialSignals.flatMap(
          ({ evidenceIds }) => evidenceIds,
        ),
      ],
      policyVersion: candidatePlan.sourcePlan.prioritization.version,
      inputHash: candidatePlan.inputHash,
    })),
  });
  if (frozenBatch) return { ...frozenBatch, triageSummary };
  const plans = triagePlans
    .filter(({ sourcePlan }) => sourcePlan.prioritization.lane === "deep_research")
    .slice(0, DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS.maxDeepResearchCandidates);
  const inputHash = hashCanonical({
    campaignRunId: context.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    contractVersion: CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION,
    plans,
  });
  const batch = await initializeCandidateResearchBatch({
    campaignRunId: context.campaignRunId,
    workspaceId: input.workspaceId,
    contractVersion: CANDIDATE_RESEARCH_RUNTIME_CONTRACT_VERSION,
    inputHash,
    plans: plans as unknown as Json,
  });
  return { ...batch, triageSummary };
}

export async function finalizeCandidateResearchStage(input: {
  batchId: string;
  workspaceId: string;
}): Promise<StageResult> {
  const summary = await finalizeCandidateResearchBatch(input);
  return {
    stage: "research_candidates",
    status: summary.blockedCount > 0 ? "partial" : "completed",
    outputReferences: {
      ...summary,
      stageScope: "question_driven_candidate_evidence",
    },
    progressDelta: {
      candidatesResearched: summary.completedCount,
      candidateResearchBlocked: summary.blockedCount,
      candidateEvidenceItems: summary.evidenceCount,
      candidateClaims: summary.claimCount,
      unresolvedResearchQuestions: summary.unresolvedQuestionCount,
    },
    usageEventIds: summary.aiRequestIds,
  };
}
