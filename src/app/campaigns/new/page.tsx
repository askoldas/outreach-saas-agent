import { redirect } from "next/navigation";
import { CampaignWizard } from "@/features/campaigns/CampaignWizard";
import { listOffers } from "@/server/offers/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";

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
  const offers = await listOffers(currentWorkspace.id);

  return (
    <>
      <PageHeader
        title="Create campaign"
        description={`Define a target market for ${currentWorkspace.name} and review a visible strategy before discovery begins.`}
      />
      <CampaignWizard error={params.error} offers={offers} />
    </>
  );
}
