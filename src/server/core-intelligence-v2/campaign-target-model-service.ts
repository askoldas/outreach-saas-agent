import { randomUUID } from "node:crypto";
import type {
  CampaignGeographyV2,
  CampaignObjectiveV2,
  CampaignStrategyV2,
} from "@/lib/intelligence/campaign-strategy-v2";
import {
  assertCampaignTargetStrategyProjection,
  compileCampaignTargetModel,
  type CampaignTargetModel,
  type CommercialIntelligence,
} from "@/lib/intelligence/core";
import {
  loadCommercialIntelligenceVersion,
  loadLatestCampaignTargetModelVersionNumber,
  persistCampaignTargetModel,
  type PersistedArtifact,
} from "./repository";

export type CampaignTargetModelServiceAdapters = {
  loadCommercialIntelligence: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CommercialIntelligence>;
  latestVersionNumber: (input: {
    workspaceId: string;
    campaignId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: CampaignTargetModel;
    versionNumber: number;
  }) => Promise<PersistedArtifact<CampaignTargetModel>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: CampaignTargetModelServiceAdapters = {
  loadCommercialIntelligence: loadCommercialIntelligenceVersion,
  latestVersionNumber: loadLatestCampaignTargetModelVersionNumber,
  persist: persistCampaignTargetModel,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistCampaignTargetModel(
  input: {
    workspaceId: string;
    campaignId: string;
    profileSnapshotId: string;
    commercialIntelligenceVersionId: string;
    selectedOfferingIds: string[];
    objective: CampaignObjectiveV2;
    geography: CampaignGeographyV2;
    confirmedConstraints: string[];
    strategyProjection?: CampaignStrategyV2;
  },
  adapters: CampaignTargetModelServiceAdapters = productionAdapters,
) {
  const commercialIntelligence = await adapters.loadCommercialIntelligence({
    workspaceId: input.workspaceId,
    id: input.commercialIntelligenceVersionId,
  });
  const artifact = compileCampaignTargetModel({
    artifactId: adapters.artifactId(),
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    profileSnapshotId: input.profileSnapshotId,
    commercialIntelligenceVersionId: input.commercialIntelligenceVersionId,
    commercialIntelligence,
    selectedOfferingIds: input.selectedOfferingIds,
    objective: input.objective,
    geography: input.geography,
    confirmedConstraints: input.confirmedConstraints,
    createdAt: adapters.now(),
  });
  if (input.strategyProjection) {
    assertCampaignTargetStrategyProjection({
      target: artifact,
      strategy: input.strategyProjection,
    });
  }
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
  });
  return adapters.persist({ artifact, versionNumber: latestVersion + 1 });
}
