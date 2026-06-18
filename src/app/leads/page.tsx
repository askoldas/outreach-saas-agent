import { redirect } from "next/navigation";
import { campaigns } from "@/data/mock/prospecting";
import { LeadsTable } from "@/features/leads/LeadsTable";
import { importSampleLeadsAction } from "@/server/leads/actions";
import { listLeads } from "@/server/leads/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import styles from "@/features/shared/Feature.module.css";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type SearchParams = {
  message?: string;
};

export default async function LeadsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const params = await searchParams;
  const leads = await listLeads(currentWorkspace.id);

  return (
    <div className={styles.grid}>
      <PageHeader
        title="Leads"
        description={`Review discovered companies for ${currentWorkspace.name} with visible fit, confidence, contactability, and status filters.`}
      />
      <Card>
        <CardHeader
          title="Review table"
          eyebrow="Workspace lead queue"
          action={
            leads.length === 0 ? (
              <form action={importSampleLeadsAction}>
                <Button type="submit" variant="primary">
                  Load sample leads
                </Button>
              </form>
            ) : null
          }
        />
        <div className={styles.cardBody}>
          {params.message === "sample-leads-imported" ? (
            <p className={styles.secondaryText}>
              Sample leads loaded for this workspace.
            </p>
          ) : null}
          <LeadsTable campaigns={campaigns} leads={leads} />
        </div>
      </Card>
    </div>
  );
}
