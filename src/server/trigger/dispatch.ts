import { runs, tasks } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { enrichCompanyContactsTask } from "@/trigger/enrich-company-contacts";
import type { executeCampaignV2Task } from "@/trigger/execute-campaign-v2";
import type { generateOutreachDraftTask } from "@/trigger/generate-outreach-draft";

const staleDispatchMs = 2 * 60 * 1_000;

async function createOperationalDatabaseClient() {
  return { supabase: createServiceRoleClient() };
}

export async function cancelTriggerRuns(triggerRunIds: string[]) {
  const uniqueRunIds = [...new Set(triggerRunIds.filter(Boolean))];
  const failures: Array<{ message: string; runId: string }> = [];
  for (const runId of uniqueRunIds) {
    try {
      await runs.cancel(runId);
    } catch (error) {
      failures.push({ message: errorMessage(error), runId });
    }
  }
  return { cancelled: uniqueRunIds.length - failures.length, failures };
}

export async function dispatchCampaignRun(input: {
  campaignRunId: string;
  idempotencyKey?: string;
  tags?: string[];
  workspaceId: string;
}) {
  const { supabase } = await createOperationalDatabaseClient();
  const { data: campaignRun, error: runError } = await supabase
    .from("campaign_runs")
    .select("workflow_version")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (runError)
    throw new Error(`Could not load Campaign workflow version: ${runError.message}`);
  if (campaignRun.workflow_version !== "v2") {
    throw new Error(
      "Historical V1 Campaign Runs are read-only and cannot be dispatched.",
    );
  }
  const dispatchKey =
    input.idempotencyKey ?? `execute-campaign-v2:${input.campaignRunId}`;
  await markDispatching(
    "campaign_runs",
    input.campaignRunId,
    input.workspaceId,
    dispatchKey,
  );
  try {
    const options = {
      idempotencyKey: dispatchKey,
      tags: [
        `workspace:${input.workspaceId}`,
        `campaign_run:${input.campaignRunId}`,
        `workflow:${campaignRun.workflow_version}`,
        ...(input.tags ?? []),
      ],
    };
    const handle = await tasks.trigger<typeof executeCampaignV2Task>(
      "execute-campaign-v2",
      {
        campaignRunId: input.campaignRunId,
        workspaceId: input.workspaceId,
      },
      options,
    );
    const { error } = await supabase
      .from("campaign_runs")
      .update({
        dispatch_state: "dispatched",
        dispatch_updated_at: new Date().toISOString(),
        last_dispatch_error: null,
        trigger_run_id: handle.id,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.campaignRunId);
    if (error) throw new Error(`Could not link Campaign dispatch: ${error.message}`);
    return handle.id;
  } catch (error) {
    await markDispatchFailed(
      "campaign_runs",
      input.campaignRunId,
      input.workspaceId,
      error,
    );
    throw error;
  }
}

export async function dispatchCampaignV2Resume(input: {
  campaignRunId: string;
  commandId: string;
  workspaceId: string;
}) {
  return (
    await tasks.trigger<typeof executeCampaignV2Task>(
      "execute-campaign-v2",
      {
        campaignRunId: input.campaignRunId,
        workspaceId: input.workspaceId,
      },
      {
        idempotencyKey: `execute-campaign-v2-resume:${input.campaignRunId}:${input.commandId}`,
        tags: [
          `workspace:${input.workspaceId}`,
          `campaign_run:${input.campaignRunId}`,
          "workflow:v2",
          "campaign_resume",
        ],
      },
    )
  ).id;
}

export async function dispatchProviderExecution(input: {
  providerExecutionId: string;
  workspaceId: string;
}) {
  const { supabase } = await createOperationalDatabaseClient();
  const { data: execution, error: loadError } = await supabase
    .from("provider_executions")
    .select("id,operation,idempotency_key,metadata")
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.providerExecutionId)
    .single();
  if (loadError)
    throw new Error(`Could not load provider dispatch: ${loadError.message}`);
  await markDispatching(
    "provider_executions",
    input.providerExecutionId,
    input.workspaceId,
    `provider-dispatch:${execution.idempotency_key}`,
  );
  try {
    const triggerRunId = await triggerProviderTask({
      execution,
      workspaceId: input.workspaceId,
    });
    const { error } = await supabase
      .from("provider_executions")
      .update({
        dispatch_state: "dispatched",
        dispatch_updated_at: new Date().toISOString(),
        last_dispatch_error: null,
        trigger_run_id: triggerRunId,
      })
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.providerExecutionId);
    if (error) throw new Error(`Could not link provider dispatch: ${error.message}`);
    return triggerRunId;
  } catch (error) {
    await markDispatchFailed(
      "provider_executions",
      input.providerExecutionId,
      input.workspaceId,
      error,
    );
    throw error;
  }
}

export async function reconcileTriggerDispatches(input: { workspaceId: string }) {
  const { supabase } = await createOperationalDatabaseClient();
  const [{ data: campaignRuns, error: campaignError }, { data: executions, error }] =
    await Promise.all([
      supabase
        .from("campaign_runs")
        .select("id,dispatch_state,dispatch_updated_at")
        .eq("workspace_id", input.workspaceId)
        .eq("workflow_version", "v2")
        .in("dispatch_state", [
          "created",
          "dispatching",
          "dispatch_failed",
          "dispatched",
        ]),
      supabase
        .from("provider_executions")
        .select("id,dispatch_state,dispatch_updated_at")
        .eq("workspace_id", input.workspaceId)
        .in("dispatch_state", [
          "created",
          "dispatching",
          "dispatch_failed",
          "dispatched",
        ]),
    ]);
  if (campaignError || error)
    throw new Error(
      `Could not inspect dispatch state: ${campaignError?.message ?? error?.message}`,
    );

  const failures: Array<{ id: string; message: string; type: string }> = [];
  let repaired = 0;
  for (const run of (campaignRuns ?? []).filter(isRecoverableDispatch)) {
    try {
      await dispatchCampaignRun({
        campaignRunId: run.id,
        workspaceId: input.workspaceId,
      });
      repaired += 1;
    } catch (dispatchError) {
      failures.push({
        id: run.id,
        message: errorMessage(dispatchError),
        type: "campaign_run",
      });
    }
  }
  for (const execution of (executions ?? []).filter(isRecoverableDispatch)) {
    if (execution.dispatch_state === "dispatched") continue;
    try {
      await dispatchProviderExecution({
        providerExecutionId: execution.id,
        workspaceId: input.workspaceId,
      });
      repaired += 1;
    } catch (dispatchError) {
      failures.push({
        id: execution.id,
        message: errorMessage(dispatchError),
        type: "provider_execution",
      });
    }
  }
  return { failures, repaired };
}

async function triggerProviderTask(input: {
  execution: {
    id: string;
    idempotency_key: string;
    metadata: unknown;
    operation: string;
  };
  workspaceId: string;
}) {
  const options = {
    idempotencyKey: `provider-dispatch:${input.execution.idempotency_key}`,
    tags: [`workspace:${input.workspaceId}`, `provider_execution:${input.execution.id}`],
  };
  if (input.execution.operation === "contact_enrichment")
    return (
      await tasks.trigger<typeof enrichCompanyContactsTask>(
        "enrich-company-contacts",
        { providerExecutionId: input.execution.id },
        options,
      )
    ).id;
  if (input.execution.operation === "draft_generation")
    return (
      await tasks.trigger<typeof generateOutreachDraftTask>(
        "generate-outreach-draft",
        { providerExecutionId: input.execution.id },
        options,
      )
    ).id;
  throw new Error(
    `Provider operation "${input.execution.operation}" has no dispatch adapter.`,
  );
}

async function markDispatching(
  table: "campaign_runs" | "provider_executions",
  id: string,
  workspaceId: string,
  dispatchKey: string,
) {
  const { supabase } = await createOperationalDatabaseClient();
  const { data, error: loadError } = await supabase
    .from(table)
    .select("dispatch_attempts")
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .single();
  if (loadError)
    throw new Error(`Could not prepare Trigger dispatch: ${loadError.message}`);
  const { error } = await supabase
    .from(table)
    .update({
      dispatch_attempts: data.dispatch_attempts + 1,
      dispatch_key: dispatchKey,
      dispatch_state: "dispatching",
      dispatch_updated_at: new Date().toISOString(),
      last_dispatch_error: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", id);
  if (error) throw new Error(`Could not start Trigger dispatch: ${error.message}`);
}

async function markDispatchFailed(
  table: "campaign_runs" | "provider_executions",
  id: string,
  workspaceId: string,
  error: unknown,
) {
  const { supabase } = await createOperationalDatabaseClient();
  await supabase
    .from(table)
    .update({
      dispatch_state: "dispatch_failed",
      dispatch_updated_at: new Date().toISOString(),
      last_dispatch_error: errorMessage(error).slice(0, 2_000),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", id);
}

function isRecoverableDispatch(value: {
  dispatch_state: string;
  dispatch_updated_at: string;
}) {
  return (
    value.dispatch_state === "created" ||
    value.dispatch_state === "dispatch_failed" ||
    Date.now() - new Date(value.dispatch_updated_at).getTime() >= staleDispatchMs
  );
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Trigger dispatch failed.";
}
