import { loadCampaignPage } from "@/server/campaigns/page-data";
import { CampaignShell } from "@/features/campaigns/CampaignShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import styles from "@/features/shared/Feature.module.css";
export default async function CampaignOverview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await loadCampaignPage(id);
  const stage =
    campaign.status === "planning"
      ? "Ready to research"
      : campaign.status === "running"
        ? "Research running"
        : "Research completed";
  return (
    <CampaignShell campaign={campaign} active="overview">
      <section className={styles.metricGrid}>
        <Card>
          <div className={styles.metric}>
            <p>Stage</p>
            <h2>{stage}</h2>
            <span>{campaign.lastActivity}</span>
          </div>
        </Card>
        <Card>
          <div className={styles.metric}>
            <p>Companies evaluated</p>
            <h2>{campaign.leadCount}</h2>
            <span>{campaign.awaitingReview} ready for review</span>
          </div>
        </Card>
        <Card>
          <div className={styles.metric}>
            <p>Progress</p>
            <h2>{campaign.progress}%</h2>
            <span>Stable review list appears after completion</span>
          </div>
        </Card>
        <Card>
          <div className={styles.metric}>
            <p>Estimated credits</p>
            <h2>{campaign.desiredLeadCount * 5}</h2>
            <span>Confirm before starting research</span>
          </div>
        </Card>
      </section>
      <Card>
        <CardHeader title="Recommended next action" eyebrow={stage} />
        <div className={styles.cardBody}>
          <p>
            {campaign.status === "completed"
              ? "Research is complete. Review the stable, sortable company list."
              : campaign.status === "running"
                ? "Discovery, deduplication, research, and qualification are in progress. Leads remain hidden until the run completes."
                : "Review the structured strategy and expected limitations before starting research."}
          </p>
          <ButtonLink
            href={
              campaign.status === "completed"
                ? `/campaigns/${id}/leads`
                : `/campaigns/${id}/strategy`
            }
            variant="primary"
          >
            {campaign.status === "completed" ? "Review leads" : "Review strategy"}
          </ButtonLink>
        </div>
      </Card>
      {campaign.warnings.length ? (
        <Card>
          <CardHeader title="Warnings" eyebrow="Attention" />
          <div className={styles.cardBody}>
            <ul className={styles.feed}>
              {campaign.warnings.map((warning) => (
                <li key={warning}>
                  <strong>{warning}</strong>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : null}
    </CampaignShell>
  );
}
