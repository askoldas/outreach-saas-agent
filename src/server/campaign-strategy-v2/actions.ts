"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { confirmCampaignStrategyV2 } from "./repository";
import { dispatchCampaignStrategyV2Compilation } from "@/server/trigger/dispatch";

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
  try {
    await dispatchCampaignStrategyV2Compilation({
      workspaceId: currentWorkspace.id,
      campaignExternalId: campaignId,
      strategyDraftId,
      idempotencyKey: `campaign-strategy-v2:${strategyDraftId}:retry:${Date.now()}`,
    });
  } catch (error) {
    revalidatePath(`/campaigns/${campaignId}`);
    revalidatePath(`/campaigns/${campaignId}/strategy`);
    const message =
      error instanceof Error
        ? `Strategy retry paused: ${error.message}`
        : "Strategy retry paused. You can retry this frozen draft again.";
    redirect(`/campaigns/${campaignId}/strategy?message=${encodeURIComponent(message)}`);
  }
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/strategy`);
  redirect(`/campaigns/${campaignId}/strategy?message=v2-strategy-queued`);
}
