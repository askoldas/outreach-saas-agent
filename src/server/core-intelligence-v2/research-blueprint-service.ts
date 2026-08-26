import { randomUUID } from "node:crypto";
import {
  compileResearchBlueprints,
  type CampaignTargetModel,
  type MarketAnalysis,
  type ResearchBlueprint,
} from "@/lib/intelligence/core";
import {
  loadCampaignTargetModelVersion,
  loadLatestResearchBlueprintVersionNumber,
  loadMarketAnalysisVersion,
  persistResearchBlueprint,
  type PersistedArtifact,
} from "./repository";

export type ResearchBlueprintServiceAdapters = {
  loadAnalysis: (input: { workspaceId: string; id: string }) => Promise<MarketAnalysis>;
  loadTarget: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CampaignTargetModel>;
  latestVersionNumber: (input: {
    workspaceId: string;
    campaignId: string;
    targetArchetypeId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: ResearchBlueprint;
    versionNumber: number;
  }) => Promise<PersistedArtifact<ResearchBlueprint>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: ResearchBlueprintServiceAdapters = {
  loadAnalysis: loadMarketAnalysisVersion,
  loadTarget: loadCampaignTargetModelVersion,
  latestVersionNumber: loadLatestResearchBlueprintVersionNumber,
  persist: persistResearchBlueprint,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistResearchBlueprints(
  input: {
    workspaceId: string;
    campaignId: string;
    marketAnalysisVersionId: string;
    campaignTargetModelVersionId: string;
  },
  adapters: ResearchBlueprintServiceAdapters = productionAdapters,
) {
  const [analysis, target] = await Promise.all([
    adapters.loadAnalysis({
      workspaceId: input.workspaceId,
      id: input.marketAnalysisVersionId,
    }),
    adapters.loadTarget({
      workspaceId: input.workspaceId,
      id: input.campaignTargetModelVersionId,
    }),
  ]);
  if (
    analysis.campaignId !== input.campaignId ||
    target.campaignId !== input.campaignId
  ) {
    throw new Error("Research Blueprint inputs belong to another Campaign.");
  }
  const artifacts = compileResearchBlueprints({
    artifactId: () => adapters.artifactId(),
    target,
    analysis,
    createdAt: adapters.now(),
  });
  return Promise.all(
    artifacts.map(async (artifact) => {
      const latestVersion = await adapters.latestVersionNumber({
        workspaceId: input.workspaceId,
        campaignId: input.campaignId,
        targetArchetypeId: artifact.targetArchetypeId,
      });
      return adapters.persist({ artifact, versionNumber: latestVersion + 1 });
    }),
  );
}
