import { task } from "@trigger.dev/sdk";
import {
  aggregateWorkflowProgress,
  type CampaignV2Stage,
  stagesForResearchCycle,
  stagesForResearchContinuation,
  researchCycleStageCheckpointKey,
} from "@/lib/workflow-v2";
import {
  ensureCampaignWorkflow,
  consumeWorkflowControl,
  loadCompletedCheckpointKeys,
  loadWorkflowCandidateProgress,
  updateCampaignWorkflow,
  ensureCampaignResearchCycle,
  finalizeCampaignResearchCycle,
  loadAdaptiveResearchSnapshot,
} from "@/server/workflow-v2/repository";
import { DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET } from "@/lib/research-budget-v2/contracts";
import { decideAdaptiveResearchNextAction } from "@/lib/adaptive-research-v2/controller";
import type { Json } from "@/types/database.types";
import { runCampaignV2StageTask } from "./run-campaign-v2-stage";

export type ExecuteCampaignV2Payload = {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
  requestedAction?:
    | "research_existing_pool"
    | "discover_more"
    | "expand_source_pages"
    | "stop_budget";
};

export const executeCampaignV2Task = task({
  id: "execute-campaign-v2",
  retry: { maxAttempts: 1 },
  onFailure: async ({
    payload,
    error,
  }: {
    payload: ExecuteCampaignV2Payload;
    error: unknown;
  }) => {
    const workflow = await ensureCampaignWorkflow({
      campaignRunId: payload.campaignRunId,
      inputReference: payload as unknown as Json,
      workspaceId: payload.workspaceId,
    });
    await updateCampaignWorkflow({
      errorSummary: { message: errorMessage(error) },
      status: "failed",
      workflowRunId: String(workflow.id),
      workspaceId: payload.workspaceId,
    });
  },
  run: async (payload: ExecuteCampaignV2Payload, { ctx }) => {
    const workflow = await ensureCampaignWorkflow({
      campaignRunId: payload.campaignRunId,
      inputReference: payload as unknown as Json,
      workspaceId: payload.workspaceId,
    });
    const workflowRunId = String(workflow.id);
    const cycleNumber = payload.cycleNumber ?? 1;
    const researchCycle = await ensureCampaignResearchCycle({
      campaignRunId: payload.campaignRunId,
      workspaceId: payload.workspaceId,
      cycleNumber,
      budget: DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET,
    });
    const initialControl = await consumeWorkflowControl({
      workflowRunId,
      workspaceId: payload.workspaceId,
    });
    if (initialControl.state !== "run") {
      return { status: initialControl.state, workflowRunId };
    }
    await updateCampaignWorkflow({
      status: "initializing",
      triggerRunId: ctx.run.id,
      workflowRunId,
      workspaceId: payload.workspaceId,
    });

    const checkpointKeys = await loadCompletedCheckpointKeys({
      workflowRunId,
      workspaceId: payload.workspaceId,
    });
    const cycleStages = payload.requestedAction
      ? stagesForResearchContinuation(payload.requestedAction)
      : stagesForResearchCycle(cycleNumber);
    const completedStages = cycleStages.filter((stage) =>
      checkpointKeys.includes(researchCycleStageCheckpointKey(stage, cycleNumber)),
    );
    const stages = cycleStages.filter((stage) => !completedStages.includes(stage));

    for (const stage of stages) {
      const beforeStage = await consumeWorkflowControl({
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      if (beforeStage.state !== "run") {
        return { status: beforeStage.state, stage, workflowRunId };
      }
      await updateCampaignWorkflow({
        progressSummary: await progress(payload, completedStages, stage),
        status: workflowStatusForStage(stage),
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      const child = await runCampaignV2StageTask.triggerAndWait(
        { ...payload, cycleNumber, stage, workflowRunId },
        {
          idempotencyKey: `campaign-v2:${workflowRunId}:cycle-${cycleNumber}:${stage}`,
          tags: [
            `workspace:${payload.workspaceId}`,
            `campaign_run:${payload.campaignRunId}`,
            `workflow_run:${workflowRunId}`,
            `workflow_stage:${stage}`,
          ],
        },
      );
      if (!child.ok)
        throw new Error(
          `V2 Campaign child "${stage}" failed: ${errorMessage(child.error)}`,
        );
      if (child.output.status === "blocked") {
        await updateCampaignWorkflow({
          outputReference: {
            blockedStage: stage,
            stageOutput: child.output.outputReferences,
          } as unknown as Json,
          progressSummary: await progress(payload, completedStages, stage),
          status: "completed_partial",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return { status: "completed_partial", stage, workflowRunId };
      }
      completedStages.push(stage);
      const afterStage = await consumeWorkflowControl({
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      if (afterStage.state !== "run") {
        return { status: afterStage.state, stage, workflowRunId };
      }
    }

    const outputReference = {
      campaignRunId: payload.campaignRunId,
      completedStages,
    } satisfies Json;
    const adaptiveSnapshot = await loadAdaptiveResearchSnapshot({
      ...payload,
      cycleId: String(researchCycle.id),
      startedAt: String(researchCycle.startedAt),
    });
    const adaptiveDecision = decideAdaptiveResearchNextAction({
      budget: DEFAULT_TEST_CAMPAIGN_RESEARCH_BUDGET,
      ...adaptiveSnapshot,
      discoverySaturated:
        adaptiveSnapshot.remainingPlausibleCandidates === 0 &&
        adaptiveSnapshot.unexpandedSourcePages === 0,
    });
    await finalizeCampaignResearchCycle({
      cycleId: String(researchCycle.id),
      workspaceId: payload.workspaceId,
      usage: adaptiveSnapshot.usage,
      decision: adaptiveDecision,
    });
    await updateCampaignWorkflow({
      outputReference: { ...outputReference, adaptiveDecision } as unknown as Json,
      progressSummary: await progress(payload, completedStages),
      status: "ready_for_review",
      workflowRunId,
      workspaceId: payload.workspaceId,
    });
    return {
      ...outputReference,
      adaptiveDecision,
      status: "ready_for_review",
      workflowRunId,
    };
  },
});

function workflowStatusForStage(stage: CampaignV2Stage) {
  if (stage === "initialize") return "initializing" as const;
  if (stage === "discover") return "discovering" as const;
  if (stage === "resolve_entities") return "resolving_entities" as const;
  if (stage === "rank_candidates") return "ranking" as const;
  return "evaluating_candidates" as const;
}

async function progress(
  payload: ExecuteCampaignV2Payload,
  completedStages: CampaignV2Stage[],
  activeStage?: CampaignV2Stage,
) {
  const candidateProgress = await loadWorkflowCandidateProgress(payload);
  return aggregateWorkflowProgress({
    completedStages,
    activeStage,
    ...candidateProgress,
  }) as unknown as Json;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown V2 workflow failure";
}
