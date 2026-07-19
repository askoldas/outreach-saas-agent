import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/user";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { getCampaign } from "./repository";
import type { Campaign } from "@/types/domain";

export async function loadCampaignPage(id: string): Promise<Campaign> {
  if (!(await getCurrentUser())) redirect(`/auth/sign-in?next=/campaigns/${id}`);
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const persisted = await getCampaign(currentWorkspace.id, id);
  if (persisted) return persisted;
  notFound();
}
