import { randomUUID } from "node:crypto";
import {
  campaignV2TaskContracts,
  type MarketContextOutput,
} from "@/lib/intelligence/campaign-strategy-v2";
import { generateCampaignMarketContext } from "@/lib/intelligence/campaign-strategy-v2/market-strategy";
import type { StrategyRuntime } from "@/lib/intelligence/campaign-strategy-v2/market-strategy";
import {
  compileMarketAnalysis,
  type CampaignTargetModel,
  type MarketAnalysis,
  type MarketAnalysisModelProvenance,
} from "@/lib/intelligence/core";
import {
  loadCampaignTargetModelVersion,
  loadLatestMarketAnalysisVersionNumber,
  persistMarketAnalysis,
  type PersistedArtifact,
} from "./repository";
import type { IntelligenceAttemptRecord } from "@/lib/intelligence/runtime/execute-ai-task";

type MarketAnalysisRuntime = StrategyRuntime & {
  recordAttempt?: (attempt: IntelligenceAttemptRecord) => Promise<void>;
};

type GeneratedMarketContext = {
  output: MarketContextOutput;
  provenance: MarketAnalysisModelProvenance;
  execution: {
    requestedModel: string;
    actualModel: string;
    fallbackUsed: boolean;
  };
};

export type MarketAnalysisServiceAdapters = {
  loadTargetModel: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CampaignTargetModel>;
  generateMarketContext: (input: {
    frozenContext: unknown;
    campaignInput: unknown;
    runtime?: MarketAnalysisRuntime;
  }) => Promise<GeneratedMarketContext>;
  latestVersionNumber: (input: {
    workspaceId: string;
    campaignRunId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: MarketAnalysis;
    campaignRunId: string;
    profileSnapshotId: string;
    requestedModel: string;
    actualModel: string;
    fallbackUsed: boolean;
    campaignStrategyVersionId?: string;
    supersedesMarketAnalysisId?: string;
    versionNumber: number;
  }) => Promise<PersistedArtifact<MarketAnalysis>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: MarketAnalysisServiceAdapters = {
  loadTargetModel: loadCampaignTargetModelVersion,
  generateMarketContext: async (input) => {
    const result = await generateCampaignMarketContext(input);
    return {
      output: result.output,
      provenance: {
        promptVersion: campaignV2TaskContracts.marketContext.promptVersion,
        modelRole: "campaign_strategy_reasoning",
        provider: result.call.provider,
        model: result.call.actualModel ?? result.call.requestedModel,
      },
      execution: {
        requestedModel: result.call.requestedModel,
        actualModel: result.call.actualModel ?? result.call.requestedModel,
        fallbackUsed: result.call.fallbackUsed,
      },
    };
  },
  latestVersionNumber: loadLatestMarketAnalysisVersionNumber,
  persist: persistMarketAnalysis,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistMarketAnalysis(
  input: {
    workspaceId: string;
    campaignId: string;
    campaignRunId: string;
    profileSnapshotId: string;
    campaignTargetModelVersionId: string;
    campaignStrategyVersionId?: string;
    supersedesMarketAnalysisId?: string;
    frozenContext: unknown;
    campaignInput: unknown;
    allowedEvidenceIds: string[];
    runtime?: MarketAnalysisRuntime;
  },
  adapters: MarketAnalysisServiceAdapters = productionAdapters,
) {
  const target = await adapters.loadTargetModel({
    workspaceId: input.workspaceId,
    id: input.campaignTargetModelVersionId,
  });
  if (target.campaignId !== input.campaignId) {
    throw new Error("Campaign Target Model belongs to another Campaign.");
  }
  const generated = await adapters.generateMarketContext({
    frozenContext: input.frozenContext,
    campaignInput: input.campaignInput,
    ...(input.runtime ? { runtime: input.runtime } : {}),
  });
  const artifact = compileMarketAnalysis({
    artifactId: adapters.artifactId(),
    target,
    marketContext: generated.output,
    allowedEvidenceIds: input.allowedEvidenceIds,
    provenance: generated.provenance,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
  });
  return adapters.persist({
    artifact,
    campaignRunId: input.campaignRunId,
    profileSnapshotId: input.profileSnapshotId,
    ...generated.execution,
    ...(input.campaignStrategyVersionId
      ? { campaignStrategyVersionId: input.campaignStrategyVersionId }
      : {}),
    ...(input.supersedesMarketAnalysisId
      ? { supersedesMarketAnalysisId: input.supersedesMarketAnalysisId }
      : {}),
    versionNumber: latestVersion + 1,
  });
}
