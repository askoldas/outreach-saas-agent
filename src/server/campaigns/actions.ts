"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importSampleCampaigns } from "./repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

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
