import Link from "next/link";
import { campaigns, drafts, getLead } from "@/data/mock/prospecting";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function DraftsPage() {
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Outreach drafts"
        description="Review generated copy, evidence links, and personalization warnings before using an external compose action."
      />
      <Card>
        <CardHeader title="Draft queue" eyebrow="Human approval required" />
        <div className={styles.cardBody}>
          <div className={styles.filters}>
            <label className={form.field} htmlFor="draft-status"><span>Status</span><select className={form.select} id="draft-status" defaultValue="all"><option>All statuses</option><option>Needs review</option><option>Edited</option><option>Approved</option></select></label>
            <label className={form.field} htmlFor="draft-campaign"><span>Campaign</span><select className={form.select} id="draft-campaign" defaultValue="all"><option>All campaigns</option>{campaigns.map((campaign) => <option key={campaign.id}>{campaign.name}</option>)}</select></label>
            <label className={form.field} htmlFor="draft-language"><span>Language</span><select className={form.select} id="draft-language" defaultValue="all"><option>All languages</option><option>English</option></select></label>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>Company</th><th>Recipient route</th><th>Campaign</th><th>Subject</th><th>Variant</th><th>Status</th><th>Last edited</th></tr></thead>
              <tbody>
                {drafts.map((draft) => {
                  const lead = getLead(draft.leadId);
                  const campaign = campaigns.find((item) => item.id === draft.campaignId);
                  return (
                    <tr key={draft.id}>
                      <td><Link className={styles.primaryText} href={`/drafts/${draft.id}`}>{lead?.company}</Link></td>
                      <td>{draft.recipientRoute}</td>
                      <td>{campaign?.name}</td>
                      <td>{draft.subject}</td>
                      <td>{statusLabel(draft.variant)}</td>
                      <td><Badge tone={statusTone(draft.status)}>{statusLabel(draft.status)}</Badge></td>
                      <td>{draft.lastEdited}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
