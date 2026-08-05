import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import styles from "@/features/shared/Feature.module.css";
import { getWorkspaceContext } from "@/server/workspaces/repository";
import { listUsageEvents } from "@/server/outreach/repository";
import { CommercialValidation } from "@/features/usage/CommercialValidation";
import { getCommercialValidationMetrics } from "@/server/usage/repository";
import { getIntelligenceRuntimeMetrics } from "@/server/intelligence-runtime/metrics-repository";
import { IntelligenceRuntimeHealth } from "@/features/usage/IntelligenceRuntimeHealth";
import { getIntelligenceFeedbackMetrics } from "@/server/intelligence-runtime/feedback-repository";
import { IntelligenceFeedbackHealth } from "@/features/usage/IntelligenceFeedbackHealth";
export default async function UsagePage() {
  const { currentWorkspace } = await getWorkspaceContext();
  if (!currentWorkspace) redirect("/onboarding/workspace");
  const [events, validation, intelligenceMetrics, feedbackMetrics] = await Promise.all([
    listUsageEvents(currentWorkspace.id),
    getCommercialValidationMetrics(currentWorkspace.id),
    getIntelligenceRuntimeMetrics({ workspaceId: currentWorkspace.id }),
    getIntelligenceFeedbackMetrics({ workspaceId: currentWorkspace.id }),
  ]);
  const actual = events.reduce((sum, event) => sum + event.actualUnits, 0);
  const estimated = events.reduce((sum, event) => sum + event.estimatedUnits, 0);
  return (
    <div className={styles.grid}>
      <PageHeader
        title="Internal usage"
        description="Raw operation counts for development diagnostics. This is not billing."
      />
      <section className={styles.metricGrid}>
        <Card>
          <div className={styles.metric}>
            <p>Completed operation units</p>
            <h2>{actual}</h2>
            <span>Raw internal telemetry</span>
          </div>
        </Card>
        <Card>
          <div className={styles.metric}>
            <p>Queued operation units</p>
            <h2>{estimated}</h2>
            <span>{events.length} immutable usage events</span>
          </div>
        </Card>
      </section>
      <IntelligenceRuntimeHealth metrics={intelligenceMetrics} />
      <IntelligenceFeedbackHealth metrics={feedbackMetrics} />
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
                <th>Queued units</th>
                <th>Completed units</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.operation.replaceAll("_", " ")}</td>
                  <td>{event.campaignId ?? "Workspace"}</td>
                  <td>{event.estimatedUnits}</td>
                  <td>{event.actualUnits}</td>
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
