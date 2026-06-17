import { CampaignWizard } from "@/features/campaigns/CampaignWizard";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewCampaignPage() {
  return (
    <>
      <PageHeader
        title="Create campaign"
        description="Define a target market and review a visible mock strategy before discovery would begin."
      />
      <CampaignWizard />
    </>
  );
}
