import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

export type CampaignStrategyStageId =
  | "baseline"
  | "market_context"
  | "advisory_delta"
  | "compilation";

export type CampaignStrategyStageRun = {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  output: Json | null;
  attemptCount: number;
};

type StageRpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
};

export async function claimCampaignStrategyStage(input: {
  workspaceId: string;
  strategyDraftId: string;
  stageId: CampaignStrategyStageId;
  cacheKey: string;
  inputHash: string;
  promptVersion: string;
  schemaVersion: string;
  contextCompilerVersion: string;
  modelRouteVersion: string;
  triggerRunId: string;
}) {
  const database = createServiceRoleClient() as unknown as StageRpcClient;
  const { data, error } = await database.rpc("claim_campaign_strategy_stage_v2", {
    target_workspace_id: input.workspaceId,
    target_strategy_draft_id: input.strategyDraftId,
    target_stage_id: input.stageId,
    target_cache_key: input.cacheKey,
    target_input_hash: input.inputHash,
    target_prompt_version: input.promptVersion,
    target_schema_version: input.schemaVersion,
    target_context_compiler_version: input.contextCompilerVersion,
    target_model_route_version: input.modelRouteVersion,
    target_trigger_run_id: input.triggerRunId,
  });
  if (error) throw new Error(`Could not claim Campaign Strategy stage: ${error.message}`);
  return stageRun(data);
}

export async function completeCampaignStrategyStage(input: {
  workspaceId: string;
  stageRunId: string;
  output: Json;
}) {
  const database = createServiceRoleClient() as unknown as StageRpcClient;
  const { data, error } = await database.rpc("complete_campaign_strategy_stage_v2", {
    target_workspace_id: input.workspaceId,
    target_stage_run_id: input.stageRunId,
    target_output: input.output,
  });
  if (error) throw new Error(`Could not complete Campaign Strategy stage: ${error.message}`);
  return stageRun(data);
}

export async function failCampaignStrategyStage(input: {
  workspaceId: string;
  stageRunId: string;
  error: unknown;
}) {
  const database = createServiceRoleClient() as unknown as StageRpcClient;
  const classified = classifyStageFailure(input.error);
  const { error } = await database.rpc("fail_campaign_strategy_stage_v2", {
    target_workspace_id: input.workspaceId,
    target_stage_run_id: input.stageRunId,
    target_error_code: classified.code,
    target_error_message: classified.message,
  });
  if (error) throw new Error(`Could not fail Campaign Strategy stage: ${error.message}`);
}

function stageRun(value: unknown): CampaignStrategyStageRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Campaign Strategy stage returned an invalid record.");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    !["pending", "running", "completed", "failed"].includes(String(row.status)) ||
    typeof row.attempt_count !== "number"
  ) {
    throw new Error("Campaign Strategy stage identity is incomplete.");
  }
  return {
    id: row.id,
    status: row.status as CampaignStrategyStageRun["status"],
    output: (row.output_json ?? null) as Json | null,
    attemptCount: row.attempt_count,
  };
}

function classifyStageFailure(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  return {
    code: typeof value?.code === "string" ? value.code : "strategy_stage_failed",
    message:
      typeof value?.message === "string" ? value.message : "Strategy stage failed.",
  };
}
