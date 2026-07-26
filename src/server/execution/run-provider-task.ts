import { createServiceRoleClient } from "@/lib/supabase/service";

export async function runProviderTask<T>(
  providerExecutionId: string,
  operation: string,
  execute: () => Promise<T>,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    await persistUnhandledTaskFailure(providerExecutionId, operation, error);
    throw error;
  }
}

async function persistUnhandledTaskFailure(
  providerExecutionId: string,
  operation: string,
  error: unknown,
) {
  const supabase = createServiceRoleClient();
  const message =
    error instanceof Error ? error.message.slice(0, 2_000) : `${operation} failed`;
  const completedAt = new Date().toISOString();
  const { data: execution, error: loadError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,campaign_run_id,status")
    .eq("id", providerExecutionId)
    .eq("operation", operation)
    .maybeSingle();

  if (loadError || !execution) return;

  if (execution.status !== "completed") {
    await supabase
      .from("provider_executions")
      .update({
        status: "failed",
        completed_at: completedAt,
        error_code: `${operation}_failed`,
        error_message: message,
      })
      .eq("id", execution.id)
      .neq("status", "completed");
  }

  if (!execution.campaign_run_id || operation !== "campaign_discovery") return;

  await Promise.all([
    supabase
      .from("campaign_runs")
      .update({
        status: "failed",
        current_phase: "failed",
        failed_at: completedAt,
        error_code: "campaign_discovery_failed",
        error_message: message,
      })
      .eq("workspace_id", execution.workspace_id)
      .eq("id", execution.campaign_run_id),
    supabase.from("campaign_run_events").insert({
      workspace_id: execution.workspace_id,
      campaign_run_id: execution.campaign_run_id,
      event_type: "campaign_discovery_failed",
      phase: "failed",
      level: "error",
      summary: "Campaign discovery failed.",
      details: { message, providerExecutionId },
      visible_to_user: true,
    }),
  ]);
}
