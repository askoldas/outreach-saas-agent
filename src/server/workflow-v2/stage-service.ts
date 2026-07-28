import type { CampaignV2Stage, StageResult } from "@/lib/workflow-v2/contracts";
import { stageCheckpointKey } from "@/lib/workflow-v2/controller";
import { classifyWorkflowError, errorForTrigger } from "@/server/execution/errors";
import { executeSemanticDiscoveryStage } from "@/server/discovery-v2/targeted-discovery-stage";
import { executeEntityResolutionStage } from "@/server/entity-resolution-v2/stage-service";
import type { Json } from "@/types/database.types";
import {
  claimWorkflowTask,
  completeWorkflowTask,
  failWorkflowTaskAttempt,
  loadCampaignV2Run,
  saveWorkflowCheckpoint,
} from "./repository";

export type ExecuteCampaignV2StageInput = {
  campaignRunId: string;
  stage: CampaignV2Stage;
  triggerRunId: string;
  workflowRunId: string;
  workspaceId: string;
};

export type CampaignV2StageAdapters = {
  qualifyCandidates?: () => Promise<StageResult>;
  researchCandidates?: () => Promise<StageResult>;
};

export async function executeCampaignV2Stage(
  input: ExecuteCampaignV2StageInput,
  adapters: CampaignV2StageAdapters = {},
): Promise<StageResult & { cached: boolean; taskRunId: string }> {
  const inputReference = {
    campaignRunId: input.campaignRunId,
    stage: input.stage,
    workflowRunId: input.workflowRunId,
  } satisfies Json;
  const taskRun = await claimWorkflowTask({
    idempotencyKey: `campaign-v2:${input.workflowRunId}:${input.stage}`,
    inputReference,
    taskType: input.stage,
    triggerRunId: input.triggerRunId,
    workflowRunId: input.workflowRunId,
    workspaceId: input.workspaceId,
  });
  if (["completed", "partial", "skipped"].includes(taskRun.status)) {
    const stored = parseStoredStageResult(input.stage, taskRun.output_reference_json);
    await checkpointStage(input, taskRun.id, stored);
    return {
      ...stored,
      cached: true,
      taskRunId: taskRun.id,
    };
  }

  try {
    const result = await runStageAdapter(input, adapters);
    await completeWorkflowTask({
      outputReference: result as unknown as Json,
      status: result.status,
      taskRunId: taskRun.id,
      workspaceId: input.workspaceId,
    });
    if (result.status !== "blocked") await checkpointStage(input, taskRun.id, result);
    return { ...result, cached: false, taskRunId: taskRun.id };
  } catch (error) {
    const classified = classifyWorkflowError(error);
    await failWorkflowTaskAttempt({
      errorCode: classified.category,
      errorDetails: {
        message: classified.message,
        stage: input.stage,
      },
      retryable: classified.retryable,
      taskRunId: taskRun.id,
      workspaceId: input.workspaceId,
    });
    throw errorForTrigger(error);
  }
}

async function checkpointStage(
  input: ExecuteCampaignV2StageInput,
  taskRunId: string,
  result: StageResult,
) {
  await saveWorkflowCheckpoint({
    checkpointKey: stageCheckpointKey(input.stage),
    payload: {
      outputReferences: result.outputReferences,
      progressDelta: result.progressDelta,
      taskRunId,
    } as unknown as Json,
    workflowRunId: input.workflowRunId,
    workspaceId: input.workspaceId,
  });
}

async function runStageAdapter(
  input: ExecuteCampaignV2StageInput,
  adapters: CampaignV2StageAdapters,
): Promise<StageResult> {
  if (input.stage === "initialize") {
    const campaignRun = await loadCampaignV2Run(input);
    return {
      stage: input.stage,
      status: "completed",
      outputReferences: {
        campaignId: campaignRun.campaign_id,
        campaignRunId: campaignRun.id,
        profileSnapshotId: campaignRun.profile_snapshot_id,
        strategyVersionId: campaignRun.strategy_version_id,
      },
      progressDelta: { initialized: 1 },
      usageEventIds: [],
    };
  }
  if (input.stage === "discover") return executeSemanticDiscoveryStage(input);
  if (input.stage === "resolve_entities") return executeEntityResolutionStage(input);
  if (input.stage === "research_candidates") {
    if (!adapters.researchCandidates) {
      throw new Error(
        'V2 stage adapter "research_candidates" requires its Trigger fan-out boundary.',
      );
    }
    return adapters.researchCandidates();
  }
  if (input.stage === "qualify_candidates") {
    if (!adapters.qualifyCandidates) {
      throw new Error(
        'V2 stage adapter "qualify_candidates" requires its Trigger fan-out boundary.',
      );
    }
    return adapters.qualifyCandidates();
  }
  throw new Error(
    `V2 stage adapter "${input.stage}" is not implemented and cannot execute.`,
  );
}

function parseStoredStageResult(stage: CampaignV2Stage, value: Json | null): StageResult {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`Stored V2 stage result for "${stage}" is invalid.`);
  const record = value as Record<string, Json | undefined>;
  if (
    record.stage !== stage ||
    !["completed", "partial", "blocked"].includes(String(record.status)) ||
    !record.outputReferences ||
    typeof record.outputReferences !== "object" ||
    Array.isArray(record.outputReferences) ||
    !record.progressDelta ||
    typeof record.progressDelta !== "object" ||
    Array.isArray(record.progressDelta) ||
    !Array.isArray(record.usageEventIds)
  )
    throw new Error(`Stored V2 stage result for "${stage}" is invalid.`);
  return value as unknown as StageResult;
}
