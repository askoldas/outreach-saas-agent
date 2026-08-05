export type IntelligenceRuntimeMetric = {
  taskId: string;
  actualModel: string;
  initialAttempts: number;
  completedOutputs: number;
  failedAttempts: number;
  repairAttempts: number;
  fallbackAttempts: number;
  timeoutAttempts: number;
  truncationAttempts: number;
  semanticFailureAttempts: number;
  successfulOutputRate: number;
  repairRate: number;
  fallbackRate: number;
  timeoutRate: number;
  truncationRate: number;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  totalInputUnits: number;
  totalOutputUnits: number;
  totalCost: number;
  currency: string;
};

export type IntelligenceReleaseThresholds = {
  minimumSuccessfulOutputRate: number;
  maximumRepairRate: number;
  maximumFallbackRate: number;
  maximumTimeoutRate: number;
  maximumTruncationRate: number;
  maximumP95LatencyMs: number;
};

export const defaultIntelligenceReleaseThresholds: IntelligenceReleaseThresholds = {
  minimumSuccessfulOutputRate: 0.98,
  maximumRepairRate: 0.15,
  maximumFallbackRate: 0.1,
  maximumTimeoutRate: 0.02,
  maximumTruncationRate: 0.02,
  maximumP95LatencyMs: 120_000,
};

export function evaluateIntelligenceReleaseMetric(
  metric: IntelligenceRuntimeMetric,
  thresholds: IntelligenceReleaseThresholds = defaultIntelligenceReleaseThresholds,
) {
  const failures: string[] = [];
  if (metric.successfulOutputRate < thresholds.minimumSuccessfulOutputRate)
    failures.push("successful_output_rate");
  if (metric.repairRate > thresholds.maximumRepairRate) failures.push("repair_rate");
  if (metric.fallbackRate > thresholds.maximumFallbackRate) failures.push("fallback_rate");
  if (metric.timeoutRate > thresholds.maximumTimeoutRate) failures.push("timeout_rate");
  if (metric.truncationRate > thresholds.maximumTruncationRate)
    failures.push("truncation_rate");
  if (
    metric.p95LatencyMs !== null &&
    metric.p95LatencyMs > thresholds.maximumP95LatencyMs
  )
    failures.push("p95_latency_ms");
  return { passed: failures.length === 0, failures };
}

