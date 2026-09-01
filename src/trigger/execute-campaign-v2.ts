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
import { DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS } from "@/lib/research-budget-v2/contracts";
import { decideAdaptiveResearchNextAction } from "@/lib/adaptive-research-v2/controller";
import type { Json } from "@/types/database.types";
import { persistEvolvingMarketOverview } from "@/server/company-research/market-overview";
import { runCampaignV2StageTask } from "./run-campaign-v2-stage";
import { bootstrapCompanyResearchContextV2Task } from "./bootstrap-company-research-context-v2";

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

const MAX_ADAPTIVE_RESEARCH_CYCLES = 6;

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
      budget: DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS,
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

    if (cycleNumber === 1 && !payload.requestedAction) {
      await bootstrapCompanyResearchContextV2Task.trigger(payload, {
        idempotencyKey: `bootstrap-company-research-context-v2:${payload.campaignRunId}`,
        tags: [
          `workspace:${payload.workspaceId}`,
          `campaign_run:${payload.campaignRunId}`,
        ],
      });
    }

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
      if (!child.ok && isResearchBudgetError(child.error)) {
        await updateCampaignWorkflow({
          errorSummary: {
            code: "research_budget_paused",
            message: errorMessage(child.error),
          },
          outputReference: {
            pausedStage: stage,
            reason: "research_budget",
          },
          progressSummary: await progress(payload, completedStages, stage),
          status: "paused",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return { status: "paused_for_budget", stage, workflowRunId };
      }
      if (!child.ok)
        throw new Error(
          `V2 Campaign child "${stage}" failed: ${errorMessage(child.error)}`,
        );
      if (child.output.status === "blocked") {
        const budgetBlocked =
          child.output.outputReferences.reason === "research_budget";
        await updateCampaignWorkflow({
          outputReference: {
            blockedStage: stage,
            stageOutput: child.output.outputReferences,
          } as unknown as Json,
          progressSummary: await progress(payload, completedStages, stage),
          status: budgetBlocked ? "paused" : "completed_partial",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return {
          status: budgetBlocked ? "paused_for_budget" : "completed_partial",
          stage,
          workflowRunId,
        };
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
      budget: DEFAULT_CAMPAIGN_RESEARCH_SAFETY_LIMITS,
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
    const marketOverview = await persistEvolvingMarketOverview({
      workspaceId: payload.workspaceId,
      campaignRunId: payload.campaignRunId,
      researchCycleId: String(researchCycle.id),
      cycleNumber,
      decision: adaptiveDecision,
    });
    const continuationAction =
      adaptiveDecision.action === "research_existing_pool" ||
      adaptiveDecision.action === "discover_more" ||
      adaptiveDecision.action === "expand_source_pages"
        ? adaptiveDecision.action
        : null;
    if (
      adaptiveDecision.additionalOpportunityRemains &&
      continuationAction &&
      cycleNumber < MAX_ADAPTIVE_RESEARCH_CYCLES
    ) {
      const nextCycle = cycleNumber + 1;
      await updateCampaignWorkflow({
        outputReference: {
          ...outputReference,
          adaptiveDecision,
          marketOverview,
        } as unknown as Json,
        progressSummary: await progress(payload, completedStages),
        status: "evaluating_candidates",
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      await executeCampaignV2Task.trigger(
        {
          campaignRunId: payload.campaignRunId,
          workspaceId: payload.workspaceId,
          cycleNumber: nextCycle,
          requestedAction: continuationAction,
        },
        {
          idempotencyKey: `execute-campaign-v2:${payload.campaignRunId}:adaptive-cycle-${nextCycle}`,
          tags: [
            `workspace:${payload.workspaceId}`,
            `campaign_run:${payload.campaignRunId}`,
            `research_cycle:${nextCycle}`,
          ],
        },
      );
      return {
        ...outputReference,
        adaptiveDecision,
        nextCycle,
        status: "continuing_research",
        workflowRunId,
      };
    }
    await updateCampaignWorkflow({
      outputReference: {
        ...outputReference,
        adaptiveDecision,
        marketOverview,
      } as unknown as Json,
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
  if (stage === "initialize" || stage === "market_analysis")
    return "initializing" as const;
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

function isResearchBudgetError(error: unknown) {
  return /research credit authorization|workspace credit balance|research budget|actual usage exceeds/i.test(
    errorMessage(error),
  );
}
