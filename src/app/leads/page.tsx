import { redirect } from "next/navigation";
import { campaigns } from "@/data/mock/prospecting";
import { LeadsTable } from "@/features/leads/LeadsTable";
import { listLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import styles from "@/features/shared/Feature.module.css";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function LeadsPage() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const leads = await listLeads(currentWorkspace.id);

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Leads"
        description={`Review discovered companies for ${currentWorkspace.name} with visible fit, confidence, contactability, and status filters.`}
      />
      <Card>
        <CardHeader title="Review table" eyebrow="Workspace lead queue" />
        <div className={styles.cardBody}>
          <LeadsTable campaigns={campaigns} leads={leads} />
        </div>
      </Card>
    </div>
  );
}
