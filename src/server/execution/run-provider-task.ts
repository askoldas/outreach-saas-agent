import { createServiceRoleClient } from "@/lib/supabase/service";
import { classifyWorkflowError } from "./errors";
import { executeProviderAttempt } from "./provider-attempt";

type ProviderTaskContext = {
  attempt: { number: number };
  run: { id: string };
};

export async function runProviderTask<T>(
  providerExecutionId: string,
  operation: string,
  context: ProviderTaskContext,
  execute: () => Promise<T>,
): Promise<T> {
  return executeProviderAttempt(execute, {
    onAttemptFailure: (error) =>
      recordAttemptFailure(providerExecutionId, operation, context, error),
    onCompleted: () =>
      updateProviderDispatch(providerExecutionId, {
        dispatch_state: "completed",
        dispatch_updated_at: new Date().toISOString(),
        last_dispatch_error: null,
      }),
    onStarted: () =>
      updateProviderDispatch(providerExecutionId, {
        dispatch_state: "running",
        dispatch_updated_at: new Date().toISOString(),
        trigger_run_id: context.run.id,
      }),
  });
}

export async function finalizeProviderTaskFailure(
  providerExecutionId: string,
  operation: string,
  error: unknown,
) {
  const supabase = createServiceRoleClient();
  const classified = classifyWorkflowError(error);
  const completedAt = new Date().toISOString();
  const { data: execution, error: loadError } = await supabase
    .from("provider_executions")
    .select("id,workspace_id,campaign_run_id,status,metadata")
    .eq("id", providerExecutionId)
    .eq("operation", operation)
    .maybeSingle();
  if (loadError || !execution || execution.status === "completed") return;

  const { data: failed, error: failureError } = await supabase
    .from("provider_executions")
    .update({
      status: "failed",
      completed_at: completedAt,
      error_code: classified.category,
      error_message: classified.message.slice(0, 2_000),
      dispatch_state: "failed",
      dispatch_updated_at: completedAt,
      last_dispatch_error: classified.message.slice(0, 2_000),
    })
    .eq("id", execution.id)
    .in("status", ["pending", "running"])
    .select("id")
    .maybeSingle();
  if (failureError || !failed) return;

  if (operation === "contact_enrichment") {
    const enrichmentId = asString(asRecord(execution.metadata).contactEnrichmentId);
    if (enrichmentId)
      await supabase
        .from("contact_enrichments")
        .update({
          status: "failed",
          completed_at: completedAt,
          error_code: classified.category,
          error_message: classified.message.slice(0, 2_000),
        })
        .eq("workspace_id", execution.workspace_id)
        .eq("id", enrichmentId)
        .in("status", ["pending", "running"]);
  }

  if (operation === "campaign_discovery" && execution.campaign_run_id) {
    await supabase
      .from("campaign_runs")
      .update({
        status: "failed",
        current_phase: "failed",
        failed_at: completedAt,
        error_code: classified.category,
        error_message: classified.message.slice(0, 2_000),
      })
      .eq("workspace_id", execution.workspace_id)
      .eq("id", execution.campaign_run_id);
    const { data: existing } = await supabase
      .from("campaign_run_events")
      .select("id")
      .eq("workspace_id", execution.workspace_id)
      .eq("campaign_run_id", execution.campaign_run_id)
      .eq("event_type", `terminal_${operation}_failure`)
      .maybeSingle();
    if (!existing)
      await supabase.from("campaign_run_events").insert({
        workspace_id: execution.workspace_id,
        campaign_run_id: execution.campaign_run_id,
        event_type: `terminal_${operation}_failure`,
        phase: "failed",
        level: "error",
        summary: "Campaign discovery failed after all permitted attempts.",
        details: { category: classified.category, providerExecutionId },
        visible_to_user: true,
      });
  }
}

async function updateProviderDispatch(
  providerExecutionId: string,
  values: {
    dispatch_state: string;
    dispatch_updated_at: string;
    last_dispatch_error?: string | null;
    trigger_run_id?: string;
  },
) {
  const { error } = await createServiceRoleClient()
    .from("provider_executions")
    .update(values)
    .eq("id", providerExecutionId);
  if (error) throw new Error(`Could not update provider dispatch: ${error.message}`);
}

async function recordAttemptFailure(
  providerExecutionId: string,
  operation: string,
  context: ProviderTaskContext,
  error: unknown,
) {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("provider_executions")
    .select("metadata,status")
    .eq("id", providerExecutionId)
    .eq("operation", operation)
    .maybeSingle();
  if (!data || data.status === "completed") return;
  const metadata = asRecord(data.metadata);
  const priorAttempts = Array.isArray(metadata.attemptFailures)
    ? metadata.attemptFailures
    : [];
  const classified = classifyWorkflowError(error);
  await supabase
    .from("provider_executions")
    .update({
      metadata: {
        ...metadata,
        attemptFailures: [
          ...priorAttempts.filter(
            (value) => asRecord(value).attempt !== context.attempt.number,
          ),
          {
            attempt: context.attempt.number,
            category: classified.category,
            failedAt: new Date().toISOString(),
            retryable: classified.retryable,
            triggerRunId: context.run.id,
          },
        ],
      },
    })
    .eq("id", providerExecutionId)
    .neq("status", "completed");
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
