import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import styles from "@/features/shared/Feature.module.css";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { listUsageEvents } from "@/server/outreach/repository";
import { CommercialValidation } from "@/features/usage/CommercialValidation";
import { getCommercialValidationMetrics } from "@/server/usage/repository";
export default async function UsagePage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [events, validation] = await Promise.all([
    listUsageEvents(currentWorkspace.id),
    getCommercialValidationMetrics(currentWorkspace.id),
  ]);
  const actual = events.reduce((sum, event) => sum + event.actualCredits, 0);
  const estimated = events.reduce((sum, event) => sum + event.estimatedCredits, 0);
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Usage & Credits"
        description="Immutable operation-level estimates and actual usage for this workspace."
      />
      <section className={styles.metricGrid}>
        <Card>
          <div className={styles.metric}>
            <p>Actual credits recorded</p>
            <h2>{actual}</h2>
            <span>No billing balance is implied</span>
          </div>
        </Card>
        <Card>
          <div className={styles.metric}>
            <p>Estimated credits</p>
            <h2>{estimated}</h2>
            <span>{events.length} immutable usage events</span>
          </div>
        </Card>
      </section>
      <CommercialValidation metrics={validation} />
      <Card>
        <CardHeader
          title="Usage history"
          eyebrow="Persisted ledger"
          action={<Badge tone="success">Recorded</Badge>}
        />
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Operation</th>
                <th>Campaign</th>
                <th>Estimated</th>
                <th>Actual</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.operation.replaceAll("_", " ")}</td>
                  <td>{event.campaignId ?? "Workspace"}</td>
                  <td>{event.estimatedCredits}</td>
                  <td>{event.actualCredits}</td>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5}>No usage events recorded yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
