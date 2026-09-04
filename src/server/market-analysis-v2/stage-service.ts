import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import {
  marketAnalysisSchema,
  marketEvidenceCorpusSchema,
  marketResearchPlanSchema,
  compileMarketEvidenceSynthesisInput,
} from "@/lib/intelligence/core";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { StageResult } from "@/lib/workflow-v2";
import { compileAndPersistCampaignTargetModel } from "@/server/core-intelligence-v2/campaign-target-model-service";
import { compileAndPersistCommercialIntelligence } from "@/server/core-intelligence-v2/commercial-intelligence-service";
import { compileAndPersistMarketAnalysis } from "@/server/core-intelligence-v2/market-analysis-service";
import { compileAndPersistMarketResearchPlan } from "@/server/core-intelligence-v2/market-research-plan-service";
import { loadInitialDiscoveryContext } from "@/server/discovery-v2/stage-context";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";
import { loadCampaignV2Run } from "@/server/workflow-v2/repository";
import { freezeEnabledDiscoveryProviderCapabilities } from "./provider-capabilities";
import { runBudgetedOpenRouterCall } from "@/server/credits/budgeted-provider-call";
import { generateTextResult } from "@/lib/providers/openrouter";
import { executeMarketReconnaissance } from "./market-reconnaissance";

export async function executeCompanyResearchBootstrap(input: {
  campaignRunId: string;
  workspaceId: string;
  resultStage?: "initialize" | "market_analysis";
}): Promise<StageResult> {
  const [context, campaignRun] = await Promise.all([
    loadInitialDiscoveryContext(input),
    loadCampaignV2Run(input),
  ]);
  if (!campaignRun.profile_snapshot_id)
    throw new Error("Market Analysis requires the Campaign Run's profile snapshot.");

  const resumed = await loadExistingMarketStageArtifacts(input);
  if (resumed.analysis) {
    const providerCapabilitySnapshotIds =
      resumed.plan?.providerCapabilitySnapshotIds ??
      (await freezeEnabledDiscoveryProviderCapabilities(input.workspaceId));
    const researchPlan = resumed.plan
      ? { id: resumed.plan.id }
      : await compileAndPersistMarketResearchPlan({
          workspaceId: input.workspaceId,
          campaignId: context.campaignInternalId,
          campaignRunId: input.campaignRunId,
          marketAnalysisVersionId: resumed.analysis.id,
          campaignTargetModelVersionId: resumed.analysis.campaignTargetModelVersionId,
          providerCapabilitySnapshotIds,
        });
    return completedResult({
      commercialIntelligenceVersionId: resumed.analysis.commercialIntelligenceVersionId,
      campaignTargetModelVersionId: resumed.analysis.campaignTargetModelVersionId,
      marketAnalysisVersionId: resumed.analysis.id,
      marketResearchPlanVersionId: researchPlan.id,
      ...(resumed.corpus ? { marketResearchExecutionId: resumed.corpus.id } : {}),
      providerCapabilitySnapshotIds,
      cached: true,
      observability: marketObservability({
        analysis: resumed.analysis,
        plan: resumed.plan,
        corpus: resumed.corpus,
      }),
      resultStage: input.resultStage,
    });
  }

  const commercial = await compileAndPersistCommercialIntelligence({
    workspaceId: input.workspaceId,
  });
  const target = await compileAndPersistCampaignTargetModel({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    profileSnapshotId: campaignRun.profile_snapshot_id,
    commercialIntelligenceVersionId: commercial.id,
    selectedOfferingIds: context.strategy.offeringReferences.map(
      ({ offeringId }) => offeringId,
    ),
    objective: context.strategy.objective,
    geography: context.strategy.geography,
    confirmedConstraints: context.strategy.campaignRules
      .filter(({ status }) => status === "confirmed")
      .map(({ description }) => description),
    strategyProjection: context.strategy,
    campaignIdentityVerifiedByRun: true,
  });
  const evidenceIds = unique([
    ...context.strategy.assumptions.flatMap(({ evidenceIds, counterEvidenceIds }) => [
      ...evidenceIds,
      ...counterEvidenceIds,
    ]),
    ...context.strategy.campaignRules.flatMap(({ evidenceIds }) => evidenceIds),
  ]);
  const reconnaissance = await executeMarketReconnaissance({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    campaignRunId: input.campaignRunId,
    target: target.artifact,
  });
  const synthesisEvidence = compileMarketEvidenceSynthesisInput(reconnaissance.corpus);
  evidenceIds.push(...synthesisEvidence.selectedEvidence.map(({ id }) => id));
  const frozenInput = {
    campaignRunId: input.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    strategy: context.strategy,
    target: target.artifact,
    marketEvidenceSynthesis: synthesisEvidence,
  };
  let providerAttempt = 0;
  const analysis = await compileAndPersistMarketAnalysis({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    campaignRunId: input.campaignRunId,
    profileSnapshotId: campaignRun.profile_snapshot_id,
    campaignTargetModelVersionId: target.id,
    campaignStrategyVersionId: context.strategyVersionId,
    frozenContext: frozenInput,
    campaignInput: context.strategy,
    allowedEvidenceIds: evidenceIds,
    runtime: {
      generateTextResult: (messages, options) => {
        const attempt = providerAttempt++;
        return runBudgetedOpenRouterCall({
          workspaceId: input.workspaceId,
          campaignRunId: input.campaignRunId,
          operation: "company_research.market_overview_bootstrap",
          idempotencyKey: `market-overview-bootstrap:${input.campaignRunId}:attempt-${attempt}`,
          billable: attempt === 0,
          execute: () => generateTextResult(messages, options),
        });
      },
      recordAttempt: createIntelligenceAttemptRecorder({
        workspaceId: input.workspaceId,
        frozenInputHash: hashCanonical(frozenInput),
        metadata: {
          campaignRunId: input.campaignRunId,
          stage: "company_research_bootstrap",
          strategyVersionId: context.strategyVersionId,
        },
      }),
    },
  });
  const providerCapabilitySnapshotIds = await freezeEnabledDiscoveryProviderCapabilities(
    input.workspaceId,
  );
  const researchPlan = await compileAndPersistMarketResearchPlan({
    workspaceId: input.workspaceId,
    campaignId: context.campaignInternalId,
    campaignRunId: input.campaignRunId,
    marketAnalysisVersionId: analysis.id,
    campaignTargetModelVersionId: target.id,
    providerCapabilitySnapshotIds,
  });

  return completedResult({
    commercialIntelligenceVersionId: commercial.id,
    campaignTargetModelVersionId: target.id,
    marketAnalysisVersionId: analysis.id,
    marketResearchPlanVersionId: researchPlan.id,
    marketResearchExecutionId: reconnaissance.corpus.id,
    providerCapabilitySnapshotIds,
    cached: commercial.cached && target.cached && analysis.cached && researchPlan.cached,
    observability: marketObservability({
      initialHypotheses: target.artifact.archetypes.map(({ id, label }) => ({
        id,
        label,
      })),
      analysis: analysis.artifact,
      plan: researchPlan.artifact,
      corpus: reconnaissance.corpus,
    }),
    resultStage: input.resultStage,
  });
}

export function executeHistoricalMarketAnalysisStage(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  return executeCompanyResearchBootstrap({ ...input, resultStage: "market_analysis" });
}

function completedResult(input: {
  commercialIntelligenceVersionId: string;
  campaignTargetModelVersionId: string;
  marketAnalysisVersionId: string;
  marketResearchPlanVersionId: string;
  marketResearchExecutionId?: string;
  providerCapabilitySnapshotIds: string[];
  cached: boolean;
  observability?: ReturnType<typeof marketObservability>;
  resultStage?: "initialize" | "market_analysis";
}): StageResult {
  return {
    stage: input.resultStage ?? "initialize",
    status: "completed",
    outputReferences: {
      ...input,
    },
    progressDelta: { marketAnalyses: 1, marketResearchPlans: 1 },
    usageEventIds: [],
  };
}

function marketObservability(input: {
  initialHypotheses?: Array<{ id: string; label: string }>;
  analysis?: ReturnType<typeof marketAnalysisSchema.parse>;
  plan?: ReturnType<typeof marketResearchPlanSchema.parse>;
  corpus?: ReturnType<typeof marketEvidenceCorpusSchema.parse>;
}) {
  const lanes = input.analysis?.opportunityLanes ?? [];
  const synthesis = input.corpus
    ? compileMarketEvidenceSynthesisInput(input.corpus)
    : undefined;
  return {
    initialHypotheses:
      input.initialHypotheses ??
      input.analysis?.targetArchetypes.map(({ archetypeId }) => ({
        id: archetypeId,
        label: archetypeId,
      })) ??
      [],
    opportunityLanes: lanes.map(({ id, label, origin, disposition, evidenceIds }) => ({
      id,
      label,
      origin,
      disposition,
      evidenceIds,
    })),
    weakOrRejectedLaneIds: lanes
      .filter(({ disposition }) => disposition === "weak" || disposition === "rejected")
      .map(({ id }) => id),
    importantMarketSources:
      input.analysis?.importantMarketSources.map(
        ({ id, name, sourceFamily, useFor, evidenceIds }) => ({
          id,
          name,
          sourceFamily,
          useFor,
          evidenceIds,
        }),
      ) ?? [],
    researchWaves:
      input.corpus?.waves.map(
        ({ waveNumber, questionIds, evidenceIds, priorityGapKeys }) => ({
          waveNumber,
          questionIds,
          evidenceIds,
          priorityGapKeys,
        }),
      ) ?? [],
    executedQueries:
      input.corpus?.questions.map(({ id, waveNumber, direction, query, derivedFromEvidenceIds }) => ({
        id,
        waveNumber,
        direction,
        query,
        derivedFromEvidenceIds,
      })) ?? [],
    waveOneSynthesis: input.corpus?.waveSummaries[0] ?? null,
    finalSynthesisInput: synthesis?.omittedEvidenceStats ?? null,
    discoveryRouteCount: input.plan?.discoveryRoutes.length ?? 0,
  };
}

async function loadExistingMarketStageArtifacts(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const [analysisResult, planResult, corpusResult] = await Promise.all([
    supabase
      .from("market_analyses")
      .select("analysis")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_research_plan_versions_v2")
      .select("plan_json")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_research_executions_v2")
      .select("corpus_json")
      .eq("workspace_id", input.workspaceId)
      .eq("campaign_run_id", input.campaignRunId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (analysisResult.error)
    throw new Error(`Could not resume Market Analysis: ${analysisResult.error.message}`);
  if (planResult.error)
    throw new Error(`Could not resume Market Research Plan: ${planResult.error.message}`);
  if (corpusResult.error)
    throw new Error(
      `Could not resume Market Research corpus: ${corpusResult.error.message}`,
    );
  const analysis = analysisResult.data
    ? marketAnalysisSchema.parse(analysisResult.data.analysis)
    : undefined;
  const plan = planResult.data
    ? marketResearchPlanSchema.parse(planResult.data.plan_json)
    : undefined;
  const corpus = corpusResult.data
    ? marketEvidenceCorpusSchema.parse(corpusResult.data.corpus_json)
    : undefined;
  if (plan && (!analysis || plan.marketAnalysisVersionId !== analysis.id))
    throw new Error("Run-tied Market Research Plan does not match Market Analysis.");
  return { analysis, plan, corpus };
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}
