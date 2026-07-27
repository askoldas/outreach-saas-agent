"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { uploadCampaignDocument } from "./repository";

export async function uploadCampaignDocumentAction(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const file = formData.get("document");
  if (!campaignId || !(file instanceof File)) throw new Error("Select a document.");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  await uploadCampaignDocument({
    campaignExternalId: campaignId,
    file,
    workspaceId: currentWorkspace.id,
  });
  revalidatePath(`/campaigns/${campaignId}/strategy`);
}
