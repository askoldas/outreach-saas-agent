import { randomUUID } from "node:crypto";
import {
  compileMarketResearchPlan,
  type CampaignTargetModel,
  type FrozenProviderCapability,
  type MarketAnalysis,
  type MarketResearchPlan,
} from "@/lib/intelligence/core";
import {
  loadCampaignTargetModelVersion,
  loadLatestMarketResearchPlanVersionNumber,
  loadMarketAnalysisVersion,
  loadProviderCapabilitySnapshots,
  isMarketAnalysisConfirmed,
  persistMarketResearchPlan,
  type PersistedArtifact,
} from "./repository";

export type MarketResearchPlanServiceAdapters = {
  loadAnalysis: (input: { workspaceId: string; id: string }) => Promise<MarketAnalysis>;
  loadTargetModel: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CampaignTargetModel>;
  loadCapabilities: (input: {
    workspaceId: string;
    ids: string[];
  }) => Promise<FrozenProviderCapability[]>;
  isAnalysisConfirmed: (input: {
    workspaceId: string;
    campaignId: string;
    marketAnalysisId: string;
  }) => Promise<boolean>;
  latestVersionNumber: (input: {
    workspaceId: string;
    campaignId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: MarketResearchPlan;
    campaignRunId?: string;
    versionNumber: number;
  }) => Promise<PersistedArtifact<MarketResearchPlan>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: MarketResearchPlanServiceAdapters = {
  loadAnalysis: loadMarketAnalysisVersion,
  loadTargetModel: loadCampaignTargetModelVersion,
  loadCapabilities: loadProviderCapabilitySnapshots,
  isAnalysisConfirmed: isMarketAnalysisConfirmed,
  latestVersionNumber: loadLatestMarketResearchPlanVersionNumber,
  persist: persistMarketResearchPlan,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistMarketResearchPlan(
  input: {
    workspaceId: string;
    campaignId: string;
    campaignRunId?: string;
    marketAnalysisVersionId: string;
    campaignTargetModelVersionId: string;
    providerCapabilitySnapshotIds: string[];
  },
  adapters: MarketResearchPlanServiceAdapters = productionAdapters,
) {
  const [analysis, target, providerCapabilities, userConfirmed] = await Promise.all([
    adapters.loadAnalysis({
      workspaceId: input.workspaceId,
      id: input.marketAnalysisVersionId,
    }),
    adapters.loadTargetModel({
      workspaceId: input.workspaceId,
      id: input.campaignTargetModelVersionId,
    }),
    adapters.loadCapabilities({
      workspaceId: input.workspaceId,
      ids: input.providerCapabilitySnapshotIds,
    }),
    adapters.isAnalysisConfirmed({
      workspaceId: input.workspaceId,
      campaignId: input.campaignId,
      marketAnalysisId: input.marketAnalysisVersionId,
    }),
  ]);
  if (
    analysis.campaignId !== input.campaignId ||
    target.campaignId !== input.campaignId
  ) {
    throw new Error("Research planning artifacts belong to another Campaign.");
  }
  const artifact = compileMarketResearchPlan({
    artifactId: adapters.artifactId(),
    analysis,
    target,
    userConfirmed,
    providerCapabilities,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
  });
  return adapters.persist({
    artifact,
    ...(input.campaignRunId ? { campaignRunId: input.campaignRunId } : {}),
    versionNumber: latestVersion + 1,
  });
}
