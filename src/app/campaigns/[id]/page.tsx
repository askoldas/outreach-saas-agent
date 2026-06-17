import { notFound } from "next/navigation";
import { getCampaign } from "@/data/mock/prospecting";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function CampaignDetailPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const campaign = getCampaign(id);

  if (!campaign) {
    notFound();
  }

  return (
    <PageHeader
      title={campaign.name}
      description="Campaign detail placeholder for the upcoming campaign interface batch."
    />
  );
}
