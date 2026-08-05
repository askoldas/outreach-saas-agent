import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  defaultIntelligenceReleaseThresholds,
  evaluateIntelligenceReleaseMetric,
  type IntelligenceRuntimeMetric,
} from "@/lib/intelligence/runtime/operational-metrics";
import styles from "@/features/shared/Feature.module.css";

export function IntelligenceRuntimeHealth({
  metrics,
}: Readonly<{ metrics: IntelligenceRuntimeMetric[] }>) {
  const evaluations = metrics.map((metric) => ({
    metric,
    evaluation: evaluateIntelligenceReleaseMetric(metric, {
      ...defaultIntelligenceReleaseThresholds,
      maximumP95LatencyMs: latencyBudget(metric.taskId),
    }),
  }));
  const unhealthy = evaluations.filter((item) => !item.evaluation.passed).length;

  return (
    <Card>
      <CardHeader
        title="Intelligence runtime health"
        eyebrow="Last 24 hours · by task and model"
        action={
          <Badge tone={unhealthy ? "warning" : "success"}>
            {metrics.length === 0
              ? "No attempts"
              : unhealthy
                ? `${unhealthy} outside threshold`
                : "Within thresholds"}
          </Badge>
        }
      />
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Task / model</th>
              <th>Health</th>
              <th>Completion</th>
              <th>Repair</th>
              <th>Fallback</th>
              <th>Timeout / truncated</th>
              <th>p95 latency</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map(({ metric, evaluation }) => (
              <tr key={`${metric.taskId}:${metric.actualModel}`}>
                <td>
                  <span className={styles.primaryText}>{taskLabel(metric.taskId)}</span>
                  <span className={styles.secondaryText}>{metric.actualModel}</span>
                </td>
                <td>
                  <Badge tone={evaluation.passed ? "success" : "warning"}>
                    {evaluation.passed
                      ? "Healthy"
                      : evaluation.failures.map(metricLabel).join(", ")}
                  </Badge>
                </td>
                <td>{percent(metric.successfulOutputRate)}</td>
                <td>{percent(metric.repairRate)}</td>
                <td>{percent(metric.fallbackRate)}</td>
                <td>
                  {percent(metric.timeoutRate)} / {percent(metric.truncationRate)}
                </td>
                <td>{duration(metric.p95LatencyMs)}</td>
                <td>
                  {metric.currency} {metric.totalCost.toFixed(4)}
                </td>
              </tr>
            ))}
            {metrics.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  No shared-runtime model attempts were recorded in the last 24 hours.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function latencyBudget(taskId: string) {
  return taskId.startsWith("campaign_strategy.") ? 90_000 : 120_000;
}

function taskLabel(value: string) {
  return value.replaceAll(".", " · ").replaceAll("_", " ");
}

function metricLabel(value: string) {
  return value.replaceAll("_", " ");
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function duration(value: number | null) {
  if (value === null) return "—";
  return value < 1_000 ? `${value} ms` : `${(value / 1_000).toFixed(1)} s`;
}

