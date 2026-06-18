"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { importSampleLeads } from "./repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export async function importSampleLeadsAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleLeads(currentWorkspace.id);

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  redirect("/leads?message=sample-leads-imported");
}
