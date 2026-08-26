import { randomUUID } from "node:crypto";
import type { CampaignPlanningProfile } from "@/lib/intelligence/campaign-strategy-v2";
import {
  compileCommercialIntelligenceFromPlanningProfile,
  type CommercialIntelligence,
} from "@/lib/intelligence/core";
import { getPublishedCampaignPlanningProfile } from "@/server/campaign-strategy-v2/repository";
import {
  loadLatestCommercialIntelligenceVersionNumber,
  persistCommercialIntelligence,
  type PersistedArtifact,
} from "./repository";

export type CommercialIntelligenceServiceAdapters = {
  loadPublishedProfile: (workspaceId: string) => Promise<CampaignPlanningProfile>;
  latestVersionNumber: (input: {
    workspaceId: string;
    companyProfileVersionId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: CommercialIntelligence;
    versionNumber: number;
  }) => Promise<PersistedArtifact<CommercialIntelligence>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: CommercialIntelligenceServiceAdapters = {
  loadPublishedProfile: loadPublishedCompanyProfileV3,
  latestVersionNumber: loadLatestCommercialIntelligenceVersionNumber,
  persist: persistCommercialIntelligence,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistCommercialIntelligence(
  input: { workspaceId: string },
  adapters: CommercialIntelligenceServiceAdapters = productionAdapters,
) {
  const profile = await adapters.loadPublishedProfile(input.workspaceId);
  const artifact = compileCommercialIntelligenceFromPlanningProfile({
    artifactId: adapters.artifactId(),
    workspaceId: input.workspaceId,
    profile,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    companyProfileVersionId: profile.profileVersionId,
  });
  return adapters.persist({ artifact, versionNumber: latestVersion + 1 });
}

export async function loadPublishedCompanyProfileV3(
  workspaceId: string,
): Promise<CampaignPlanningProfile> {
  const profile = await getPublishedCampaignPlanningProfile(workspaceId);
  if (!profile) throw new Error("A published Company Profile V3 is required.");
  return profile;
}
