import { redirect } from "next/navigation";
import { CampaignBriefForm } from "@/features/campaigns/CampaignBriefForm";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCurrentCompanyProfile } from "@/server/company-profile/repository";
import { getGuidedDraft } from "@/server/guided/repository";
import { getWorkspaceIntelligenceSettings } from "@/server/intelligence-settings/repository";

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
  const profile = await getCurrentCompanyProfile(currentWorkspace.id);
  if (!profile?.structuredProfile)
    redirect("/company-profile?error=structured-profile-required");
  const draft = await getGuidedDraft(currentWorkspace.id, "campaign", "new");
  const settings = await getWorkspaceIntelligenceSettings(currentWorkspace.id);

  return (
    <>
      <PageHeader
        title="Create campaign"
        description={`Define a target market for ${currentWorkspace.name} and review a visible strategy before discovery begins.`}
      />
      <CampaignBriefForm
        error={params.error}
        profile={profile}
        initialDraft={draft}
        strategyV2={settings.campaignWorkflow === "v2"}
      />
    </>
  );
}
