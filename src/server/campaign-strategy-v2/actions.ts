"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { confirmCampaignStrategyV2 } from "./repository";
import { resumeInitialCampaignStrategyV2 } from "./service";

export async function confirmCampaignStrategyV2Action(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const settings = await getWorkspaceIntelligenceSettings(currentWorkspace.id);
  if (settings.campaignWorkflow !== "v2") {
    throw new Error("Campaign Strategy V2 is not enabled for this workspace.");
  }
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const strategyDraftId = String(formData.get("strategyDraftId") ?? "").trim();
  if (!campaignId || !strategyDraftId) throw new Error("Campaign strategy is missing.");
  await confirmCampaignStrategyV2({
    workspaceId: currentWorkspace.id,
    strategyDraftId,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/strategy`);
  redirect(`/campaigns/${campaignId}/strategy?message=v2-strategy-confirmed`);
}

export async function retryCampaignStrategyV2Action(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const settings = await getWorkspaceIntelligenceSettings(currentWorkspace.id);
  if (settings.campaignWorkflow !== "v2") {
    throw new Error("Campaign Strategy V2 is not enabled for this workspace.");
  }
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const strategyDraftId = String(formData.get("strategyDraftId") ?? "").trim();
  if (!campaignId || !strategyDraftId) throw new Error("Campaign strategy is missing.");
  await resumeInitialCampaignStrategyV2({
    workspaceId: currentWorkspace.id,
    campaignExternalId: campaignId,
    strategyDraftId,
  });
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/strategy`);
  redirect(`/campaigns/${campaignId}/strategy?message=v2-strategy-recovered`);
}
