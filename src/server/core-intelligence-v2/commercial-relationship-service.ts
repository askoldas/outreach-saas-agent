import { randomUUID } from "node:crypto";
import {
  compileCommercialRelationshipAssessment,
  type CampaignTargetModel,
  type CommercialRelationshipAssessment,
  type CompanyIntelligence,
} from "@/lib/intelligence/core";
import {
  loadCampaignTargetModelVersion,
  loadCompanyIntelligenceVersion,
  loadLatestCommercialRelationshipAssessmentVersionNumber,
  persistCommercialRelationshipAssessment,
  type PersistedArtifact,
} from "./repository";

export type CommercialRelationshipServiceAdapters = {
  loadCompanyIntelligence: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CompanyIntelligence>;
  loadTarget: (input: {
    workspaceId: string;
    id: string;
  }) => Promise<CampaignTargetModel>;
  latestVersionNumber: (input: {
    workspaceId: string;
    campaignId: string;
    organizationId: string;
  }) => Promise<number>;
  persist: (input: {
    artifact: CommercialRelationshipAssessment;
    matchedArchetypeIds: string[];
    versionNumber: number;
  }) => Promise<PersistedArtifact<CommercialRelationshipAssessment>>;
  artifactId: () => string;
  now: () => string;
};

const productionAdapters: CommercialRelationshipServiceAdapters = {
  loadCompanyIntelligence: loadCompanyIntelligenceVersion,
  loadTarget: loadCampaignTargetModelVersion,
  latestVersionNumber: loadLatestCommercialRelationshipAssessmentVersionNumber,
  persist: persistCommercialRelationshipAssessment,
  artifactId: randomUUID,
  now: () => new Date().toISOString(),
};

export async function compileAndPersistCommercialRelationshipAssessment(
  input: {
    workspaceId: string;
    campaignId: string;
    companyIntelligenceVersionId: string;
    campaignTargetModelVersionId: string;
    matchedArchetypeIds: string[];
  },
  adapters: CommercialRelationshipServiceAdapters = productionAdapters,
) {
  const [companyIntelligence, target] = await Promise.all([
    adapters.loadCompanyIntelligence({
      workspaceId: input.workspaceId,
      id: input.companyIntelligenceVersionId,
    }),
    adapters.loadTarget({
      workspaceId: input.workspaceId,
      id: input.campaignTargetModelVersionId,
    }),
  ]);
  if (target.campaignId !== input.campaignId) {
    throw new Error("Commercial Relationship Target Model belongs to another Campaign.");
  }
  const artifact = compileCommercialRelationshipAssessment({
    artifactId: adapters.artifactId(),
    companyIntelligence,
    target,
    matchedArchetypeIds: input.matchedArchetypeIds,
    createdAt: adapters.now(),
  });
  const latestVersion = await adapters.latestVersionNumber({
    workspaceId: input.workspaceId,
    campaignId: input.campaignId,
    organizationId: companyIntelligence.organizationId,
  });
  return adapters.persist({
    artifact,
    matchedArchetypeIds: input.matchedArchetypeIds,
    versionNumber: latestVersion + 1,
  });
}
