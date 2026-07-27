import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { SequencesReportTable } from "@/features/outreach/SequencesReportTable";
import styles from "@/features/shared/Feature.module.css";
import { listCampaigns } from "@/server/campaigns/repository";
import { listDrafts } from "@/server/drafts/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function SequencesPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [campaigns, drafts] = await Promise.all([
    listCampaigns(currentWorkspace.id),
    listDrafts(currentWorkspace.id),
  ]);
  const rows = campaigns.flatMap((campaign) => {
    const campaignDrafts = drafts.filter((draft) => draft.campaignId === campaign.id);
    return campaignDrafts.length ? [{ campaign, drafts: campaignDrafts }] : [];
  });
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Sequences"
        description="Prepared outreach across campaigns. Sending, scheduling, and reply tracking are not connected yet."
      />
      <Card>
        <CardHeader
          title="Prepared sequences"
          eyebrow={`${rows.length} campaign sequences`}
        />
        {rows.length ? (
          <SequencesReportTable rows={rows} />
        ) : (
          <div className={styles.emptyState}>
            <p>
              No outreach sequences have been prepared. Open a campaign and enrich
              contacts first.
            </p>
            <ButtonLink href="/campaigns">Open campaigns</ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
