"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importSampleDrafts } from "./repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function importSampleDraftsAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleDrafts(currentWorkspace.id);

  revalidatePath("/dashboard");
  revalidatePath("/drafts");
  redirect("/drafts?message=sample-drafts-imported");
}
