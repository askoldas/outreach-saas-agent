import { createServiceRoleClient } from "@/lib/supabase/service";
import type { IntelligenceRuntimeMetric } from "@/lib/intelligence/runtime/operational-metrics";

type MetricRow = Record<string, string | number | null>;

export async function getIntelligenceRuntimeMetrics(input: {
  workspaceId: string;
  since?: string;
}): Promise<IntelligenceRuntimeMetric[]> {
  type MetricsClient = {
    rpc(
      name: "get_intelligence_runtime_metrics",
      args: { target_workspace_id: string; target_since?: string },
    ): Promise<{ data: MetricRow[] | null; error: { message: string } | null }>;
  };
  const { data, error } = await (createServiceRoleClient() as unknown as MetricsClient).rpc(
    "get_intelligence_runtime_metrics",
    {
      target_workspace_id: input.workspaceId,
      ...(input.since ? { target_since: input.since } : {}),
    },
  );
  if (error) throw new Error(`Could not load Intelligence runtime metrics: ${error.message}`);
  return (data ?? []).map(mapMetricRow);
}

function mapMetricRow(row: MetricRow): IntelligenceRuntimeMetric {
  return {
    taskId: String(row.task_id),
    actualModel: String(row.actual_model),
    initialAttempts: number(row.initial_attempts),
    completedOutputs: number(row.completed_outputs),
    failedAttempts: number(row.failed_attempts),
    repairAttempts: number(row.repair_attempts),
    fallbackAttempts: number(row.fallback_attempts),
    timeoutAttempts: number(row.timeout_attempts),
    truncationAttempts: number(row.truncation_attempts),
    semanticFailureAttempts: number(row.semantic_failure_attempts),
    successfulOutputRate: number(row.successful_output_rate),
    repairRate: number(row.repair_rate),
    fallbackRate: number(row.fallback_rate),
    timeoutRate: number(row.timeout_rate),
    truncationRate: number(row.truncation_rate),
    p50LatencyMs: nullableNumber(row.p50_latency_ms),
    p95LatencyMs: nullableNumber(row.p95_latency_ms),
    totalInputUnits: number(row.total_input_units),
    totalOutputUnits: number(row.total_output_units),
    totalCost: number(row.total_cost),
    currency: String(row.currency),
  };
}

function number(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function nullableNumber(value: string | number | null | undefined) {
  return value == null ? null : Number(value);
}
