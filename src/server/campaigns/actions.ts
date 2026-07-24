"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignStatus } from "@/types/domain";
import { createCampaign, getCampaign, updateCampaignStatus } from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { enqueueCampaignDiscoveryRun } from "@/server/research/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import {
  getCurrentCompanyProfile,
  saveCompanyProfileVersion,
} from "@/server/company-profile/repository";
import {
  calculateReadiness,
  parseStructuredCompanyProfile,
} from "@/lib/company-profile/structured-profile";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);

export async function discoverCampaignLeadsAction(campaignId: string) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  const campaign = await getCampaign(currentWorkspace.id, campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const { runId } = await enqueueCampaignDiscoveryRun({
    campaignId: campaign.id,
    desiredLeadCount: campaign.desiredLeadCount,
    workspaceId: currentWorkspace.id,
  });
  if (campaign.status === "planning" || campaign.status === "paused") {
    await updateCampaignStatus(currentWorkspace.id, campaign.id, "running");
  }

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
    message: `Discovery queued. Worker will process run ${runId}.`,
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
        ? "Campaign running"
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
  const geography = getString(formData, "geography");

  if (name.length < 2 || geography.length < 2) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent(
        "Enter a campaign name and target geography.",
      )}`,
    );
  }

  const campaign = await createCampaign(currentWorkspace.id, {
    desiredLeadCount: getPositiveNumber(formData, "desiredLeadCount", 25),
    exclusions: getList(formData, "exclusions"),
    geography,
    industryTerms: getList(formData, "industryTerms"),
    language: getString(formData, "language") || "English",
    localizedTerms: getList(formData, "localizedTerms"),
    name,
    objective: getString(formData, "objective") || "Direct buyers",
    qualificationCriteria: getList(formData, "qualificationCriteria"),
    sourceCategories: getList(formData, "sourceCategories"),
    targetSegments: getList(formData, "targetSegments"),
    terms: getList(formData, "terms"),
    selectedOfferingId: getString(formData, "selectedOfferingId") || null,
    offeringOverrides: getJsonObject(formData, "offeringOverrides"),
  });
  if (getString(formData, "saveAsOfferingDefaults") === "yes") {
    const profile = await getCurrentCompanyProfile(currentWorkspace.id);
    const selectedOfferingId = getString(formData, "selectedOfferingId");
    if (profile?.structuredProfile && selectedOfferingId) {
      const draft = structuredClone(profile.structuredProfile);
      const offering = draft.offerings.find((item) => item.id === selectedOfferingId);
      if (offering) {
        offering.buyerPersonas = getList(formData, "buyerPersonas").map((title) => ({
          titleGroup: title,
          exampleTitles: [title],
        }));
        offering.qualificationRequirements = getList(formData, "qualificationCriteria");
        offering.disqualifyingConditions = getList(formData, "exclusions");
        offering.prospectingMarkets = getList(formData, "geography");
        draft.readiness = calculateReadiness(draft);
        await saveCompanyProfileVersion(currentWorkspace.id, {
          ...profile,
          structuredProfile: parseStructuredCompanyProfile(draft),
          provenance: "manual",
        });
      }
    }
  }
  await createActivityEvent(currentWorkspace.id, {
    description: `${campaign.name} was created for ${campaign.geography}.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign created",
  });

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect(`/campaigns/${campaign.id}`);
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getList(formData: FormData, key: string) {
  return getString(formData, key)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPositiveNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getJsonObject(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, unknown>;
  } catch {
    return {};
  }
}
