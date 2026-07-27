import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { GlobalLeadsNav } from "@/features/leads/GlobalLeadsNav";
import styles from "@/features/shared/Feature.module.css";
import { getWorkspaceContext } from "@/server/workspaces/repository";

export default async function GlobalContactsPage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Leads"
        description="Enriched people associated with discovered companies across campaigns."
      />
      <GlobalLeadsNav active="contacts" />
      <Card>
        <CardHeader title="Contacts" eyebrow="0 person leads" />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr className={styles.expandedRow}>
                <th>Select</th>
                <th>Contact</th>
                <th>Title</th>
                <th>Company</th>
                <th>Email</th>
                <th>Verification</th>
                <th>Fit</th>
                <th>Campaign</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={10}>
                  <div className={styles.emptyState}>
                    <p>
                      The current data model stores company-level public channels, not
                      structured named people. Those channels remain available in
                      Companies details and are not counted as leads.
                    </p>
                    <ButtonLink href="/leads/companies">View companies</ButtonLink>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
