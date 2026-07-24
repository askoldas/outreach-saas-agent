import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { CampaignsReportTable } from "@/features/campaigns/CampaignsReportTable";
import styles from "@/features/shared/Feature.module.css";
import { listCampaigns } from "@/server/campaigns/repository";
import { listDrafts } from "@/server/drafts/repository";
import { listLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function CampaignsPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [campaigns, companies, drafts] = await Promise.all([
    listCampaigns(currentWorkspace.id),
    listLeads(currentWorkspace.id),
    listDrafts(currentWorkspace.id),
  ]);
  const contactsByCampaign = new Map<string, number>();
  const draftsByCampaign = new Map<string, number>();
  companies.forEach((company) =>
    contactsByCampaign.set(
      company.campaignId,
      (contactsByCampaign.get(company.campaignId) ?? 0) + company.contacts.length,
    ),
  );
  drafts.forEach((draft) =>
    draftsByCampaign.set(
      draft.campaignId,
      (draftsByCampaign.get(draft.campaignId) ?? 0) + 1,
    ),
  );
  const channelCount = [...contactsByCampaign.values()].reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Campaigns"
        description={`Create and manage markets, targeting, and campaign outcomes for ${currentWorkspace.name}.`}
        actions={
          <ButtonLink href="/campaigns/new" variant="primary">
            Create campaign
          </ButtonLink>
        }
      />
      <section className={styles.metricGrid} aria-label="Workspace campaign summary">
        <Card className={styles.metric}>
          <p>Active campaigns</p>
          <h2>{campaigns.filter((campaign) => campaign.status === "running").length}</h2>
          <span>{campaigns.length} campaigns total</span>
        </Card>
        <Card className={styles.metric}>
          <p>Companies discovered</p>
          <h2>{companies.length}</h2>
          <span>Across all campaigns</span>
        </Card>
        <Card className={styles.metric}>
          <p>Public channels found</p>
          <h2>{channelCount}</h2>
          <span>Company-level routes, not person leads</span>
        </Card>
        <Card className={styles.metric}>
          <p>Outreach drafts</p>
          <h2>{drafts.length}</h2>
          <span>Prepared, not automatically sent</span>
        </Card>
      </section>
      <Card>
        <CardHeader title="Campaign list" eyebrow="Market objectives" />
        {campaigns.length ? (
          <CampaignsReportTable
            rows={campaigns.map((campaign) => ({
              campaign,
              contacts: contactsByCampaign.get(campaign.id) ?? 0,
              drafts: draftsByCampaign.get(campaign.id) ?? 0,
            }))}
          />
        ) : (
          <div className={styles.emptyState}>
            <p>
              No campaigns yet. Create a campaign to define a market and begin discovery.
            </p>
            <ButtonLink href="/campaigns/new" variant="primary">
              Create campaign
            </ButtonLink>
          </div>
        )}
      </Card>
    </div>
  );
}
