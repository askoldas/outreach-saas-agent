"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignStatus } from "@/types/domain";
import {
  createCampaign,
  importSampleCampaigns,
  updateCampaignStatus,
} from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);

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
  const offerId = getString(formData, "offerId");
  const geography = getString(formData, "geography");

  if (name.length < 2 || !offerId || geography.length < 2) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent(
        "Enter a campaign name, selected offer, and target geography.",
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
    offerId,
    qualificationCriteria: getList(formData, "qualificationCriteria"),
    sourceCategories: getList(formData, "sourceCategories"),
    targetSegments: getList(formData, "targetSegments"),
    terms: getList(formData, "terms"),
  });
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

export async function importSampleCampaignsAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleCampaigns(currentWorkspace.id);

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect("/campaigns?message=sample-campaigns-imported");
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
