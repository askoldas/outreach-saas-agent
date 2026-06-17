import Link from "next/link";
import { activity, campaigns, drafts, getOffer, leads } from "@/data/mock/prospecting";
import { confidenceTone, scoreTone, statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DashboardPage() {
  const awaitingReview = leads.filter((lead) => lead.status === "needs_review").length;
  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "running").length;

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Overview"
        description="Monitor active campaigns, lead quality, and review work before any external outreach."
        actions={
          <ButtonLink href="/campaigns/new" variant="primary">
            Create campaign
          </ButtonLink>
        }
      />

      <section className={styles.metricGrid} aria-label="Workspace metrics">
        <Card className={styles.metric}>
          <p>Active campaigns</p>
          <h2>{activeCampaigns}</h2>
          <span>{campaigns.length} total campaign strategies</span>
        </Card>
        <Card className={styles.metric}>
          <p>Leads discovered</p>
          <h2>{leads.length}</h2>
          <span>{campaigns.reduce((sum, campaign) => sum + campaign.leadCount, 0)} total found</span>
        </Card>
        <Card className={styles.metric}>
          <p>Awaiting review</p>
          <h2>{awaitingReview}</h2>
          <span>Human approval required before drafting</span>
        </Card>
        <Card className={styles.metric}>
          <p>Drafts ready</p>
          <h2>{drafts.length}</h2>
          <span>No draft is marked as sent automatically</span>
        </Card>
      </section>

      <section className={styles.twoColumn}>
        <Card>
          <CardHeader title="Campaign activity" eyebrow="Recent campaigns" />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Offer</th>
                  <th>Geography</th>
                  <th>Progress</th>
                  <th>Leads</th>
                  <th>Status</th>
                  <th>Last activity</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link className={styles.primaryText} href={`/campaigns/${campaign.id}`}>
                        {campaign.name}
                      </Link>
                      <span className={styles.secondaryText}>{campaign.objective}</span>
                    </td>
                    <td>{getOffer(campaign.offerId)?.name}</td>
                    <td>{campaign.geography}</td>
                    <td>
                      <div className={styles.progress} aria-label={`${campaign.progress}% complete`}>
                        <span style={{ width: `${campaign.progress}%` }} />
                      </div>
                    </td>
                    <td>{campaign.leadCount}</td>
                    <td>
                      <Badge tone={statusTone(campaign.status)}>
                        {statusLabel(campaign.status)}
                      </Badge>
                    </td>
                    <td>{campaign.lastActivity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent activity" eyebrow="Timeline" />
          <div className={styles.cardBody}>
            <ul className={styles.feed}>
              {activity.map((item) => (
                <li key={item.id}>
                  <span>{item.time}</span>
                  <strong>{item.label}</strong>
                  <p>{item.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader title="Leads requiring review" eyebrow="Human checkpoint" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Company</th>
                <th>Country</th>
                <th>Campaign</th>
                <th>Fit score</th>
                <th>Evidence confidence</th>
                <th>Review action</th>
              </tr>
            </thead>
            <tbody>
              {leads.slice(0, 4).map((lead) => {
                const campaign = getCampaignLabel(lead.campaignId);
                return (
                  <tr key={lead.id}>
                    <td>
                      <Link className={styles.primaryText} href={`/leads/${lead.id}`}>
                        {lead.company}
                      </Link>
                      <span className={styles.secondaryText}>{lead.companyType}</span>
                    </td>
                    <td>{lead.country}</td>
                    <td>{campaign}</td>
                    <td>
                      <Badge tone={scoreTone(lead.fitScore)}>{lead.fitScore}</Badge>
                    </td>
                    <td>
                      <Badge tone={confidenceTone(lead.confidence)}>
                        {statusLabel(lead.confidence)}
                      </Badge>
                    </td>
                    <td>
                      <ButtonLink href={`/leads/${lead.id}`}>Review</ButtonLink>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function getCampaignLabel(campaignId: string) {
  return campaigns.find((campaign) => campaign.id === campaignId)?.name ?? "Unknown campaign";
}
