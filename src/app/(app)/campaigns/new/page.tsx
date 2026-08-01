import { redirect } from "next/navigation";
import { CampaignBriefForm } from "@/features/campaigns/CampaignBriefForm";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";
import { getGuidedDraft } from "@/server/guided/repository";
import { getPublishedCampaignPlanningProfile } from "@/server/campaign-strategy-v2/repository";

type SearchParams = {
  error?: string;
};

export default async function NewCampaignPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const params = await searchParams;
  const profile = await getPublishedCampaignPlanningProfile(currentWorkspace.id);
  if (!profile) redirect("/company-profile?error=company-intelligence-required");
  const draft = await getGuidedDraft(currentWorkspace.id, "campaign", "new");

  return (
    <>
      <PageHeader
        title="Create campaign"
        description={`Define a target market for ${currentWorkspace.name} and review a visible strategy before discovery begins.`}
      />
      <CampaignBriefForm error={params.error} profile={profile} initialDraft={draft} />
    </>
  );
}
