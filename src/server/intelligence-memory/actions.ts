"use server";

import { revalidatePath } from "next/cache";
import type { Json } from "@/types/database.types";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { recordCampaignCorrection, resolveMemoryPromotion } from "./repository";

export async function recordCampaignCorrectionAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  const campaignId = field(formData, "campaignInternalId");
  const campaignExternalId = field(formData, "campaignId");
  const statement = field(formData, "statement");
  if (!campaignId || !campaignExternalId || !statement)
    throw new Error("Campaign correction is incomplete.");
  await recordCampaignCorrection({
    workspaceId: currentWorkspace.id,
    campaignId,
    correctionType: field(formData, "correctionType") || "targeting",
    statement,
    previousValue: json(formData, "previousValue"),
    correctedValue: json(formData, "correctedValue") ?? {},
    immediateAction: field(formData, "immediateAction") || "Re-evaluate affected output.",
    applicability: json(formData, "applicability") ?? {},
    proposedOfferingId: field(formData, "proposedOfferingId") || null,
  });
  revalidatePath(`/campaigns/${campaignExternalId}`);
}

export async function resolveMemoryPromotionAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required.");
  const decision = field(formData, "decision");
  if (!["accepted", "rejected", "deferred"].includes(decision))
    throw new Error("Unsupported Memory promotion decision.");
  await resolveMemoryPromotion({
    workspaceId: currentWorkspace.id,
    proposalId: field(formData, "proposalId"),
    decision: decision as "accepted" | "rejected" | "deferred",
  });
  revalidatePath("/settings");
}

function field(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function json(formData: FormData, key: string): Json | null {
  const value = field(formData, key);
  if (!value) return null;
  try {
    return JSON.parse(value) as Json;
  } catch {
    throw new Error(`Invalid structured correction field: ${key}.`);
  }
}
