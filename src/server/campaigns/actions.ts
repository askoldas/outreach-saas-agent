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
import { enqueueCampaignDiscoveryRun } from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { generateCampaignBriefProposal } from "@/lib/ai/campaign-brief-proposal";
import {
  campaignBriefPromptVersion,
  parseConfirmedCampaignBrief,
  parseCampaignBriefProposal,
} from "@/lib/campaign-workflow/contracts";
import { deriveDiscoveryLanguages } from "@/lib/discovery/languages";
import { createInitialCampaignStrategyV2 } from "@/server/campaign-strategy-v2/service";
import { dispatchCampaignStrategyV2Compilation } from "@/server/trigger/dispatch";
import { getPublishedCampaignPlanningProfile } from "@/server/campaign-strategy-v2/repository";
import { controlActiveCampaignWorkflowV2 } from "@/server/workflow-v2/control-service";
import { parseCampaignObjective } from "@/lib/campaign-workflow/objective-compatibility";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);

export async function proposeCampaignBriefAction(input: {
  countryCodes: string[];
  regionLabel?: string;
  objective: string;
  selectedOfferingKey: string;
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
  const profile = await getPublishedCampaignPlanningProfile(currentWorkspace.id);
  if (!profile) {
    throw new Error("Publish the Company Profile before planning a campaign.");
  }
  const objective = parseCampaignObjective(input.objective);
  const result = await generateCampaignBriefProposal({
    geography: { countryCodes, ...(regionLabel ? { regionLabel } : {}) },
    profile,
    objective,
    selectedOfferingKey: input.selectedOfferingKey,
    runtime: {
      recordAttempt: createIntelligenceAttemptRecorder({
        workspaceId: currentWorkspace.id,
        frozenInputHash: hashCanonical({
          geography: { countryCodes, regionLabel: regionLabel ?? null },
          objective,
          profileVersionId: profile.profileVersionId,
          selectedOfferingKey: input.selectedOfferingKey,
        }),
        metadata: { profileVersionId: profile.profileVersionId },
      }),
    },
  });
  return {
    proposal: result.proposal,
    profileVersionId: profile.profileVersionId,
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

  const v2Control = await controlActiveCampaignWorkflowV2({
    campaignExternalId: input.campaignId,
    command:
      input.status === "completed"
        ? "cancel"
        : input.status === "paused"
          ? "pause"
          : "resume",
    workspaceId: currentWorkspace.id,
  });
  if (!v2Control) {
    throw new Error(
      "No active V2 Campaign Run is available for this control. Historical V1 runs are read-only.",
    );
  }
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
        ? "Campaign resume queued"
        : input.status === "paused"
          ? "Campaign pause requested"
          : "Campaign stopped",
  };
}

export async function createCampaignAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const name = getString(formData, "name");
  const profile = await getPublishedCampaignPlanningProfile(currentWorkspace.id);
  if (!profile) {
    redirect("/company-profile?error=company-intelligence-required");
  }
  const validOfferingIds = new Set(
    profile.offerings.map((offering) => offering.stableKey),
  );
  const objectiveCode = parseCampaignObjective(getString(formData, "campaignObjective"));
  const proposal = parseCampaignBriefProposal(
    getJson(formData, "briefProposal"),
    validOfferingIds,
  );
  const confirmedBrief = parseConfirmedCampaignBrief(
    getJson(formData, "confirmedBrief"),
    validOfferingIds,
    objectiveCode,
  );
  const clarificationAnswer = parseClarificationAnswer(
    getJson(formData, "clarificationAnswer"),
  );
  if (proposal.ambiguity?.requiresClarification && !clarificationAnswer) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent("Answer the campaign clarification before starting.")}`,
    );
  }
  if (clarificationAnswer) {
    const appliedAnswer = `Campaign clarification: ${clarificationAnswer.answer}`;
    confirmedBrief.targetClient.characteristics = Array.from(
      new Set([...confirmedBrief.targetClient.characteristics, appliedAnswer]),
    );
    confirmedBrief.targetSegments = confirmedBrief.targetSegments.map((segment) =>
      segment.status === "confirmed"
        ? {
            ...segment,
            characteristics: Array.from(
              new Set([...segment.characteristics, appliedAnswer]),
            ),
          }
        : segment,
    );
  }
  const geography =
    confirmedBrief.geography.regionLabel ||
    confirmedBrief.geography.countryCodes.join(", ");
  const selectedOfferingId = confirmedBrief.offering.profileOfferingIds[0]!;
  const selectedOffering = profile.offerings.find(
    (offering) => offering.stableKey === selectedOfferingId,
  );
  if (!selectedOffering) throw new Error("The selected offering is no longer published.");
  const proposalInput = {
    geography: {
      countryCodes: confirmedBrief.geography.countryCodes,
      ...(confirmedBrief.geography.regionLabel
        ? { regionLabel: confirmedBrief.geography.regionLabel }
        : {}),
    },
    objective: objectiveCode,
    selectedOfferingKey: selectedOffering.stableKey,
    selectedOfferingVersionId: selectedOffering.offeringVersionId,
    profileVersionId: profile.profileVersionId,
  };
  const expectedInputHash = hashCanonical(proposalInput);
  const provenanceMatches =
    proposal.provenance?.objective === objectiveCode &&
    proposal.provenance.selectedOfferingKey === selectedOffering.stableKey &&
    proposal.provenance.selectedOfferingVersionId ===
      selectedOffering.offeringVersionId &&
    proposal.provenance.profileVersionId === profile.profileVersionId &&
    proposal.provenance.promptVersion === campaignBriefPromptVersion &&
    [expectedInputHash, "server-verified-on-confirmation"].includes(
      proposal.provenance.inputHash,
    );
  if (!provenanceMatches) {
    throw new Error(
      "The target proposal is stale. Generate it again after reviewing geography, objective, and offering.",
    );
  }
  proposal.provenance = {
    ...proposalInput,
    promptVersion: campaignBriefPromptVersion,
    inputHash: expectedInputHash,
  };
  const confirmedTargetSegments = confirmedBrief.targetSegments.filter(
    (segment) => segment.status === "confirmed",
  );
  const targetSegments = Array.from(
    new Set(confirmedTargetSegments.flatMap((segment) => segment.organizationTypes)),
  );

  if (
    name.length < 2 ||
    geography.length < 2 ||
    !targetSegments.length ||
    confirmedBrief.offering.valueProposition.trim().length < 2
  ) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent(
        "Select an offering and confirm the campaign name, market, and target segment.",
      )}`,
    );
  }

  const campaign = await createCampaign(currentWorkspace.id, {
    desiredLeadCount: confirmedBrief.desiredQualifiedCompanies,
    exclusions: Array.from(
      new Set(confirmedTargetSegments.flatMap((segment) => segment.exclusions)),
    ),
    geography,
    industryTerms: Array.from(
      new Set(confirmedTargetSegments.flatMap((segment) => segment.industries)),
    ),
    preferredOutreachLanguage: confirmedBrief.geography.primaryLanguage || "English",
    discoveryLanguages: deriveDiscoveryLanguages({
      countryCodes: confirmedBrief.geography.countryCodes,
    }),
    localizedTerms: [],
    name,
    objective: confirmedTargetSegments.map((segment) => segment.summary).join(" "),
    qualificationCriteria: Array.from(
      new Set(
        confirmedTargetSegments.flatMap((segment) => [
          ...segment.characteristics,
          ...segment.buyingSignals,
        ]),
      ),
    ),
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
        ...confirmedTargetSegments.flatMap((segment) => segment.industries),
        ...confirmedTargetSegments.flatMap((segment) => segment.organizationTypes),
      ]),
    ),
    selectedOfferingId,
    offeringOverrides: {
      offering: confirmedBrief.offering,
      targetClient: confirmedBrief.targetClient,
      targetSegments: confirmedTargetSegments,
    },
  });
  await saveCampaignBrief(currentWorkspace.id, campaign.id, {
    profileVersionId: profile.profileVersionId,
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

  let strategyDraftId: string;
  try {
    ({ strategyDraftId } = await createInitialCampaignStrategyV2({
      workspaceId: currentWorkspace.id,
      campaign,
      confirmedBrief,
      objectiveCode,
    }));
    await dispatchCampaignStrategyV2Compilation({
      workspaceId: currentWorkspace.id,
      campaignExternalId: campaign.id,
      strategyDraftId,
    });
  } catch (error) {
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaign.id}/strategy`);
    const message =
      error instanceof Error
        ? `Strategy setup paused: ${error.message}`
        : "Strategy setup paused. Retry it from the Strategy page.";
    redirect(`/campaigns/${campaign.id}/strategy?message=${encodeURIComponent(message)}`);
  }
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}/strategy`);
  redirect(
    `/campaigns/${campaign.id}/strategy?message=${encodeURIComponent(
      `Strategy draft ${strategyDraftId.slice(0, 8)} is queued for compilation.`,
    )}`,
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
