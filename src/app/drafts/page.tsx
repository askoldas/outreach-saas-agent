import Link from "next/link";
import { redirect } from "next/navigation";
import { listCampaigns } from "@/server/campaigns/repository";
import { importSampleDraftsAction } from "@/server/drafts/actions";
import { listDrafts } from "@/server/drafts/repository";
import { listLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { statusLabel, statusTone } from "@/lib/format";
import styles from "@/features/shared/Feature.module.css";
import form from "@/components/ui/FormControls.module.css";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  message?: string;
};

export default async function DraftsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const params = await searchParams;
  const [campaigns, drafts, leads] = await Promise.all([
    listCampaigns(currentWorkspace.id),
    listDrafts(currentWorkspace.id),
    listLeads(currentWorkspace.id),
  ]);
  const campaignNameById = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.name]),
  );
  const leadCompanyById = new Map(leads.map((lead) => [lead.id, lead.company]));

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Outreach drafts"
        description={`Review generated copy, evidence links, and personalization warnings for ${currentWorkspace.name}.`}
      />
      <Card>
        <CardHeader
          title="Draft queue"
          eyebrow="Human approval required"
          action={
            drafts.length === 0 ? (
              <form action={importSampleDraftsAction}>
                <Button type="submit" variant="primary">
                  Load sample drafts
                </Button>
              </form>
            ) : null
          }
        />
        <div className={styles.cardBody}>
          {params.message === "sample-drafts-imported" ? (
            <p className={styles.secondaryText}>
              Sample drafts loaded for this workspace.
            </p>
          ) : null}
          <div className={styles.filters}>
            <label className={form.field} htmlFor="draft-status">
              <span>Status</span>
              <select className={form.select} id="draft-status" defaultValue="all">
                <option>All statuses</option>
                <option>Needs review</option>
                <option>Edited</option>
                <option>Approved</option>
              </select>
            </label>
            <label className={form.field} htmlFor="draft-campaign">
              <span>Campaign</span>
              <select className={form.select} id="draft-campaign" defaultValue="all">
                <option>All campaigns</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className={form.field} htmlFor="draft-language">
              <span>Language</span>
              <select className={form.select} id="draft-language" defaultValue="all">
                <option>All languages</option>
                <option>English</option>
              </select>
            </label>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Recipient route</th>
                  <th>Campaign</th>
                  <th>Subject</th>
                  <th>Variant</th>
                  <th>Status</th>
                  <th>Last edited</th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No drafts have been saved for this workspace yet.</td>
                  </tr>
                ) : null}
                {drafts.map((draft) => {
                  const leadCompany = leadCompanyById.get(draft.leadId);
                  const campaignName = campaignNameById.get(draft.campaignId);
                  return (
                    <tr key={draft.id}>
                      <td>
                        <Link className={styles.primaryText} href={`/drafts/${draft.id}`}>
                          {leadCompany ?? "Unknown lead"}
                        </Link>
                      </td>
                      <td>{draft.recipientRoute}</td>
                      <td>{campaignName ?? "Unknown campaign"}</td>
                      <td>{draft.subject}</td>
                      <td>{statusLabel(draft.variant)}</td>
                      <td>
                        <Badge tone={statusTone(draft.status)}>
                          {statusLabel(draft.status)}
                        </Badge>
                      </td>
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
