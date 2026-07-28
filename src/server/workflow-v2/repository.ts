import { createServiceRoleClient } from "@/lib/supabase/service";
import { fingerprintJson } from "@/lib/workflow-v2/fingerprint";
import type { Json } from "@/types/database.types";
import { z } from "zod";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type WorkflowTaskRecord = {
  attempt_count: number;
  id: string;
  input_fingerprint: string;
  output_reference_json: Json | null;
  status: string;
  task_type: string;
  workflow_run_id: string;
  workspace_id: string;
};

export type CampaignWorkflowRecord = {
  campaign_run_id: string;
  id: string;
  status: string;
  trigger_run_id: string | null;
  workspace_id: string;
};

const workflowControlSchema = z.object({
  state: z.enum(["run", "paused", "cancelled", "terminal"]),
  workflowRunId: z.string().uuid(),
  campaignRunId: z.string().uuid(),
  commandId: z.string().uuid().nullable(),
});

export async function ensureCampaignWorkflow(input: {
  campaignRunId: string;
  inputReference: Json;
  workspaceId: string;
}) {
  return rpcRecord("ensure_campaign_workflow_v2", {
    target_campaign_run_id: input.campaignRunId,
    target_input_reference: input.inputReference,
    target_workspace_id: input.workspaceId,
  });
}

export async function claimWorkflowTask(input: {
  idempotencyKey: string;
  inputReference: Json;
  parentTaskRunId?: string;
  taskType: string;
  triggerRunId?: string;
  workflowRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("claim_intelligence_task_v2", {
    target_idempotency_key: input.idempotencyKey,
    target_input_fingerprint: fingerprintJson(input.inputReference),
    target_input_reference: input.inputReference,
    target_parent_task_run_id: input.parentTaskRunId ?? null,
    target_task_type: input.taskType,
    target_trigger_run_id: input.triggerRunId ?? null,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function completeWorkflowTask(input: {
  metrics?: Json;
  outputReference: Json;
  status?: "completed" | "partial" | "blocked" | "skipped";
  taskRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("complete_intelligence_task_v2", {
    target_metrics: input.metrics ?? {},
    target_output_reference: input.outputReference,
    target_status: input.status ?? "completed",
    target_task_run_id: input.taskRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function failWorkflowTaskAttempt(input: {
  errorCode: string;
  errorDetails: Json;
  retryable: boolean;
  taskRunId: string;
  workspaceId: string;
}) {
  return rpcTaskRecord("fail_intelligence_task_attempt_v2", {
    target_error_code: input.errorCode,
    target_error_details: input.errorDetails,
    target_retryable: input.retryable,
    target_task_run_id: input.taskRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function saveWorkflowCheckpoint(input: {
  checkpointKey: string;
  payload: Json;
  workflowRunId: string;
  workspaceId: string;
}) {
  return rpcRecord("save_workflow_checkpoint_v2", {
    target_checkpoint_key: input.checkpointKey,
    target_payload: input.payload,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
}

export async function loadCompletedCheckpointKeys(input: {
  workflowRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("workflow_checkpoints")
    .select("checkpoint_key")
    .eq("workspace_id", input.workspaceId)
    .eq("workflow_run_id", input.workflowRunId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load V2 workflow checkpoints: ${error.message}`);
  return [...new Set((data ?? []).map(({ checkpoint_key }) => checkpoint_key))];
}

export async function loadCampaignV2Run(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("campaign_runs")
    .select(
      "id,campaign_id,profile_snapshot_id,strategy_version_id,workflow_version,status",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("id", input.campaignRunId)
    .single();
  if (error) throw new Error(`Could not load V2 Campaign Run: ${error.message}`);
  if (data.workflow_version !== "v2")
    throw new Error("V2 workflow cannot execute a non-V2 Campaign Run.");
  return data;
}

export async function consumeWorkflowControl(input: {
  workflowRunId: string;
  workspaceId: string;
}) {
  const value = await rpcRecord("consume_campaign_workflow_control_v2", {
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  });
  return workflowControlSchema.parse(value);
}

export async function loadWorkflowCandidateProgress(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data: batch, error: batchError } = await supabase
    .from("candidate_qualification_batches_v2")
    .select("id,candidate_count,blocked_count")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .maybeSingle();
  if (batchError)
    throw new Error(`Could not reconcile V2 Candidate progress: ${batchError.message}`);
  return {
    failedCandidateCount: batch?.blocked_count ?? 0,
    totalCandidateCount: batch?.candidate_count ?? 0,
  };
}

export async function updateCampaignWorkflow(input: {
  errorSummary?: Json | null;
  outputReference?: Json;
  progressSummary?: Json;
  status:
    | "queued"
    | "initializing"
    | "discovering"
    | "resolving_entities"
    | "evaluating_candidates"
    | "ranking"
    | "ready_for_review"
    | "paused"
    | "cancelled"
    | "completed"
    | "completed_partial"
    | "failed";
  triggerRunId?: string;
  workflowRunId: string;
  workspaceId: string;
}) {
  return (await rpcRecord("settle_campaign_workflow_v2", {
    target_error_summary: input.errorSummary ?? null,
    target_output_reference: input.outputReference ?? null,
    target_progress_summary: input.progressSummary ?? null,
    target_status: input.status,
    target_trigger_run_id: input.triggerRunId ?? null,
    target_workflow_run_id: input.workflowRunId,
    target_workspace_id: input.workspaceId,
  })) as unknown as CampaignWorkflowRecord;
}

async function rpcTaskRecord(name: string, args: Record<string, unknown>) {
  const record = await rpcRecord(name, args);
  return record as WorkflowTaskRecord;
}

async function rpcRecord(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`V2 workflow persistence failed: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error(`${name} returned an invalid record.`);
  return data as Record<string, Json>;
}
