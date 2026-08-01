import type { StageResult } from "@/lib/workflow-v2";
import { resolveCampaignEntities } from "./repository";

export async function executeEntityResolutionStage(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<StageResult> {
  const summary = await resolveCampaignEntities(input);
  if (summary.candidateCount > 0 && summary.campaignCandidateCount === 0) {
    throw new Error(
      "Entity Resolution deferred every discovered candidate for review; refusing to complete an empty Campaign Run.",
    );
  }
  return {
    stage: "resolve_entities",
    status: summary.needsReview > 0 ? "partial" : "completed",
    outputReferences: {
      ...summary,
      stageScope: "canonical_organization_resolution",
    },
    progressDelta: {
      campaignCandidates: summary.campaignCandidateCount,
      candidateGroups: summary.groupCount,
      canonicalOrganizations: summary.canonicalOrganizations,
      duplicatesOrMergedEntities: summary.duplicatesOrMergedEntities,
      invalidEntities: summary.invalidEntities,
      resolutionNeedsReview: summary.needsReview,
    },
    usageEventIds: [],
  };
}
