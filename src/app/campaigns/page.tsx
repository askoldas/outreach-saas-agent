import Link from "next/link";
import { campaigns, getOffer } from "@/data/mock/prospecting";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function CampaignsPage() {
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Campaigns"
        description="Review market strategies, progress, lead volume, and warnings for mock prospecting campaigns."
        actions={<ButtonLink href="/campaigns/new" variant="primary">Create campaign</ButtonLink>}
      />
      <Card>
        <CardHeader title="Campaign list" eyebrow="Market objectives" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Offer</th>
                <th>Objective</th>
                <th>Geography</th>
                <th>Segments</th>
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
                  </td>
                  <td>{getOffer(campaign.offerId)?.name}</td>
                  <td>{campaign.objective}</td>
                  <td>{campaign.geography}</td>
                  <td>{campaign.targetSegments.slice(0, 2).join(", ")}</td>
                  <td>
                    <div className={styles.progress} aria-label={`${campaign.progress}% complete`}>
                      <span style={{ width: `${campaign.progress}%` }} />
                    </div>
                  </td>
                  <td>{campaign.leadCount}</td>
                  <td><Badge tone={statusTone(campaign.status)}>{statusLabel(campaign.status)}</Badge></td>
                  <td>{campaign.lastActivity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
