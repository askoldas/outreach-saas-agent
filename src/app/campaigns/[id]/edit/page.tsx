import { notFound, redirect } from "next/navigation";
import { CampaignWizard } from "@/features/campaigns/CampaignWizard";
import { getCampaign } from "@/server/campaigns/repository";
import { listOffers } from "@/server/offers/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  error?: string;
};

export default async function EditCampaignPage({
  params,
  searchParams,
}: Readonly<{ params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }>) {
  const { id } = await params;
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const [campaign, offers, query] = await Promise.all([
    getCampaign(currentWorkspace.id, id),
    listOffers(currentWorkspace.id),
    searchParams,
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Edit campaign"
        description={`Update target market and review strategy for ${campaign.name}.`}
      />
      <CampaignWizard
        campaign={campaign}
        error={query.error}
        mode="edit"
        offers={offers}
      />
    </>
  );
}
