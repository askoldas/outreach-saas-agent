"use server";

import { revalidatePath } from "next/cache";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function reviewCampaignMemoryAction(formData: FormData) {
  const campaignId = field(formData, "campaignId");
  const memoryId = field(formData, "memoryId");
  const decision = field(formData, "decision");
  if (!campaignId || !memoryId || !["approved", "rejected"].includes(decision))
    throw new Error("Invalid Campaign learning decision.");
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) throw new Error("Authentication required");
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("campaign_memories")
    .update({ approval_status: decision })
    .eq("workspace_id", currentWorkspace.id)
    .eq("id", memoryId)
    .eq("approval_status", "proposed");
  if (error) throw new Error(`Could not review Campaign learning: ${error.message}`);
  revalidatePath(`/campaigns/${campaignId}/leads`);
}

function field(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}
