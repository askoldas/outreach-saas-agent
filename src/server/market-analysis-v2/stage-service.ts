import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { marketAnalysisSchema, marketResearchPlanSchema } from "@/lib/intelligence/core";
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
      providerCapabilitySnapshotIds,
      cached: true,
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
  const frozenInput = {
    campaignRunId: input.campaignRunId,
    strategyVersionId: context.strategyVersionId,
    strategy: context.strategy,
    target: target.artifact,
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
    providerCapabilitySnapshotIds,
    cached: commercial.cached && target.cached && analysis.cached && researchPlan.cached,
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
  providerCapabilitySnapshotIds: string[];
  cached: boolean;
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

async function loadExistingMarketStageArtifacts(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const [analysisResult, planResult] = await Promise.all([
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
  ]);
  if (analysisResult.error)
    throw new Error(`Could not resume Market Analysis: ${analysisResult.error.message}`);
  if (planResult.error)
    throw new Error(`Could not resume Market Research Plan: ${planResult.error.message}`);
  const analysis = analysisResult.data
    ? marketAnalysisSchema.parse(analysisResult.data.analysis)
    : undefined;
  const plan = planResult.data
    ? marketResearchPlanSchema.parse(planResult.data.plan_json)
    : undefined;
  if (plan && (!analysis || plan.marketAnalysisVersionId !== analysis.id))
    throw new Error("Run-tied Market Research Plan does not match Market Analysis.");
  return { analysis, plan };
}

function unique(values: string[]) {
  return [...new Set(values)].sort();
}
