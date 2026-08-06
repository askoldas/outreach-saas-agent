import { Card, CardHeader } from "@/components/ui/Card";
import type { IntelligenceFeedbackMetric } from "@/server/intelligence-runtime/feedback-repository";
import styles from "@/features/shared/Feature.module.css";

export function IntelligenceFeedbackHealth({
  metrics,
}: Readonly<{ metrics: IntelligenceFeedbackMetric[] }>) {
  return (
    <Card>
      <CardHeader
        title="Cache reuse and user feedback"
        eyebrow="Last 24 hours · authoritative events"
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Task / review surface</th>
              <th>Metric</th>
              <th>Observed</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) =>
              metric.metricScope === "cache" ? (
                <tr key={`cache:${metric.taskId}`}>
                  <td>{label(metric.taskId)}</td>
                  <td>Cache reuse</td>
                  <td>
                    {metric.cacheHits} hits / {metric.cacheMisses} generated
                  </td>
                  <td>{percent(metric.cacheReuseRate)}</td>
                </tr>
              ) : (
                <tr key={`feedback:${metric.taskId}`}>
                  <td>{label(metric.taskId)}</td>
                  <td>User edits / rejections</td>
                  <td>
                    {metric.userEdits} / {metric.userRejections} of {metric.reviewedOutputs}
                  </td>
                  <td>
                    {percent(metric.userEditRate)} / {percent(metric.userRejectionRate)}
                  </td>
                </tr>
              ),
            )}
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={4}>No cache or review events were recorded in this window.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function label(value: string) {
  return value.replaceAll(".", " · ").replaceAll("_", " ");
}

function percent(value: number | null) {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

