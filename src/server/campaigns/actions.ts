"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignStatus } from "@/types/domain";
import {
  createCampaign,
  getCampaign,
  saveCampaignBrief,
  updateCampaignStatus,
} from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { completeGuidedDraft } from "@/server/guided/repository";
import {
  enqueueCampaignDiscoveryRun,
  resumePausedCampaignRun,
} from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { generateCampaignBriefProposal } from "@/lib/ai/campaign-brief-proposal";
import {
  campaignBriefPromptVersion,
  parseConfirmedCampaignBrief,
  parseCampaignBriefProposal,
} from "@/lib/campaign-workflow/contracts";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);

export async function proposeCampaignBriefAction(input: {
  countryCodes: string[];
  regionLabel?: string;
}) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  const countryCodes = Array.from(
    new Set(input.countryCodes.map((code) => code.trim().toUpperCase()).filter(Boolean)),
  ).slice(0, 30);
  const regionLabel = input.regionLabel?.trim().slice(0, 120);
  if (!countryCodes.length && !regionLabel) {
    throw new Error("Choose at least one country or region first.");
  }
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!profile.id || !profile.structuredProfile) {
    throw new Error("Publish the Company Profile before planning a campaign.");
  }
  const result = await generateCampaignBriefProposal({
    geography: { countryCodes, ...(regionLabel ? { regionLabel } : {}) },
    profile: profile.structuredProfile,
  });
  return {
    proposal: result.proposal,
    profileVersionId: profile.id,
    promptVersion: result.promptVersion,
    requestedModel: result.modelCall.requestedModel,
    actualModel: result.modelCall.actualModel ?? result.modelCall.requestedModel,
    fallbackUsed: result.modelCall.fallbackUsed,
  };
}

export async function discoverCampaignLeadsAction(campaignId: string) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  const campaign = await getCampaign(currentWorkspace.id, campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }
  if (campaign.status === "running") {
    throw new Error("This campaign already has an active discovery run.");
  }
  if (campaign.status === "paused") {
    throw new Error(
      "This campaign has a paused run. Continue it or stop it before starting another run.",
    );
  }

  const { runId } = await enqueueCampaignDiscoveryRun({
    campaignId: campaign.id,
    desiredLeadCount: campaign.desiredLeadCount,
    workspaceId: currentWorkspace.id,
  });
  await updateCampaignStatus(currentWorkspace.id, campaign.id, "running");

  await createActivityEvent(currentWorkspace.id, {
    description: `Lead discovery run ${runId} was queued for ${campaign.name}.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign discovery queued",
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);

  return {
    message: `Discovery queued in Campaign Run ${runId}.`,
    runId,
  };
}

export async function updateCampaignStatusAction(input: UpdateCampaignStatusInput) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  if (!input.campaignId || !controlStatuses.has(input.status)) {
    throw new Error("Unsupported campaign status.");
  }

  await updateCampaignStatus(currentWorkspace.id, input.campaignId, input.status);
  const resumed =
    input.status === "running"
      ? await resumePausedCampaignRun({
          campaignId: input.campaignId,
          workspaceId: currentWorkspace.id,
        })
      : null;
  await createActivityEvent(currentWorkspace.id, {
    description: `Campaign ${input.campaignId} moved to ${input.status}.`,
    entityExternalId: input.campaignId,
    entityType: "campaign",
    label: "Campaign status updated",
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${input.campaignId}`);
  revalidatePath("/dashboard");

  return {
    message:
      input.status === "running"
        ? resumed
          ? "Campaign run resumed"
          : "Campaign running"
        : input.status === "paused"
          ? "Campaign paused"
          : "Campaign completed",
  };
}

export async function createCampaignAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const name = getString(formData, "name");
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!profile.id || !profile.structuredProfile) {
    redirect("/company-profile?error=structured-profile-required");
  }
  const validOfferingIds = new Set(
    profile.structuredProfile.offerings.map((offering) => offering.id),
  );
  const proposal = parseCampaignBriefProposal(
    getJson(formData, "briefProposal"),
    validOfferingIds,
  );
  const confirmedBrief = parseConfirmedCampaignBrief(
    getJson(formData, "confirmedBrief"),
    validOfferingIds,
  );
  const clarificationAnswer = parseClarificationAnswer(
    getJson(formData, "clarificationAnswer"),
  );
  if (proposal.ambiguity?.requiresClarification && !clarificationAnswer) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent("Answer the campaign clarification before starting.")}`,
    );
  }
  const geography =
    confirmedBrief.geography.regionLabel ||
    confirmedBrief.geography.countryCodes.join(", ");
  const selectedOfferingId = confirmedBrief.offering.profileOfferingIds[0]!;
  const targetSegments = confirmedBrief.targetClient.companyTypes;

  if (name.length < 2 || geography.length < 2 || !targetSegments.length) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent(
        "Select an offering and confirm the campaign name, market, and target segment.",
      )}`,
    );
  }

  const campaign = await createCampaign(currentWorkspace.id, {
    desiredLeadCount: confirmedBrief.desiredQualifiedCompanies,
    exclusions: confirmedBrief.targetClient.exclusions,
    geography,
    industryTerms: confirmedBrief.targetClient.industries,
    language: confirmedBrief.geography.primaryLanguage || "English",
    localizedTerms: [],
    name,
    objective: confirmedBrief.targetClient.summary,
    qualificationCriteria: confirmedBrief.targetClient.requiredCriteria,
    sourceCategories: [
      "Company websites",
      "Public business directories",
      "Trade associations",
      "Event exhibitors",
      "Partner directories",
    ],
    targetSegments,
    terms: Array.from(
      new Set([
        confirmedBrief.offering.title,
        ...confirmedBrief.targetClient.industries,
        ...confirmedBrief.targetClient.companyTypes,
      ]),
    ),
    selectedOfferingId,
    offeringOverrides: {
      offering: confirmedBrief.offering,
      targetClient: confirmedBrief.targetClient,
    },
  });
  await saveCampaignBrief(currentWorkspace.id, campaign.id, {
    profileVersionId: profile.id,
    proposal,
    confirmedBrief,
    promptVersion:
      getString(formData, "proposalPromptVersion") || campaignBriefPromptVersion,
    requestedModel: getString(formData, "proposalRequestedModel"),
    actualModel: getString(formData, "proposalActualModel"),
    fallbackUsed: getString(formData, "proposalFallbackUsed") === "true",
    clarificationAnswer,
  });
  await createActivityEvent(currentWorkspace.id, {
    description: `${campaign.name} was created for ${campaign.geography}.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign created",
  });
  await completeGuidedDraft(currentWorkspace.id, "campaign", "new");

  const { runId } = await enqueueCampaignDiscoveryRun({
    campaignId: campaign.id,
    desiredLeadCount: campaign.desiredLeadCount,
    workspaceId: currentWorkspace.id,
  });
  await updateCampaignStatus(currentWorkspace.id, campaign.id, "running");

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect(
    `/campaigns/${campaign.id}?message=${encodeURIComponent(`Campaign started in run ${runId}.`)}`,
  );
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getJson(formData: FormData, key: string): unknown {
  const value = getString(formData, key);
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseClarificationAnswer(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const answer = (value as Record<string, unknown>).answer;
  if (typeof answer !== "string" || !answer.trim()) return null;
  return { answer: answer.trim().slice(0, 2_000) };
}
