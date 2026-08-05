import { createServiceRoleClient } from "@/lib/supabase/service";

export type IntelligenceFeedbackMetric = {
  metricScope: "cache" | "feedback";
  taskId: string;
  cacheHits: number;
  cacheMisses: number;
  cacheReuseRate: number | null;
  reviewedOutputs: number;
  userEdits: number;
  userRejections: number;
  userEditRate: number | null;
  userRejectionRate: number | null;
};

export async function getIntelligenceFeedbackMetrics(input: {
  workspaceId: string;
  since?: string;
}): Promise<IntelligenceFeedbackMetric[]> {
  type FeedbackClient = {
    rpc(name: "get_intelligence_feedback_metrics", args: Record<string, string>): Promise<{
      data: Array<Record<string, string | number | null>> | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await (createServiceRoleClient() as unknown as FeedbackClient).rpc(
    "get_intelligence_feedback_metrics",
    {
      target_workspace_id: input.workspaceId,
      ...(input.since ? { target_since: input.since } : {}),
    },
  );
  if (error) throw new Error(`Could not load Intelligence feedback metrics: ${error.message}`);
  return (data ?? []).map((row) => ({
    metricScope: String(row.metric_scope) as "cache" | "feedback",
    taskId: String(row.task_id),
    cacheHits: Number(row.cache_hits ?? 0),
    cacheMisses: Number(row.cache_misses ?? 0),
    cacheReuseRate: nullableNumber(row.cache_reuse_rate),
    reviewedOutputs: Number(row.reviewed_outputs ?? 0),
    userEdits: Number(row.user_edits ?? 0),
    userRejections: Number(row.user_rejections ?? 0),
    userEditRate: nullableNumber(row.user_edit_rate),
    userRejectionRate: nullableNumber(row.user_rejection_rate),
  }));
}

function nullableNumber(value: string | number | null | undefined) {
  return value == null ? null : Number(value);
}

