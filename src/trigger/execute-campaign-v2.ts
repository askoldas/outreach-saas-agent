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
import { loadCompanyResearchOutcomeProgress } from "@/server/company-research/outcome-progress";
import { finalizeCompanyResearchOutcome } from "@/server/credits/repository";
import {
  completionReasonForAdaptiveAction,
  completionReasonForWorkflowError,
} from "@/lib/company-research/terminal-reason";
import type { CompanyResearchCompletionReason } from "@/lib/company-research/outcome";

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
    const completionReason = completionReasonForWorkflowError(error);
    const outcome = await settleTerminalOutcome(payload, completionReason);
    await updateCampaignWorkflow({
      errorSummary: { message: errorMessage(error) },
      outputReference: outcome
        ? ({ completionReason, outcome } as unknown as Json)
        : undefined,
      status:
        completionReason === "technical_failure"
          ? "failed"
          : completionReason === "user_stopped"
            ? "cancelled"
            : "completed_partial",
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
      if (initialControl.state === "cancelled")
        await settleTerminalOutcome(payload, "user_stopped");
      return { status: initialControl.state, workflowRunId };
    }
    await updateCampaignWorkflow({
      status: "initializing",
      triggerRunId: ctx.run.id,
      workflowRunId,
      workspaceId: payload.workspaceId,
    });

    const initialOutcome = await settleReachedOutcome(payload);
    if (initialOutcome) {
      await updateCampaignWorkflow({
        outputReference: { outcome: initialOutcome } as unknown as Json,
        status: "ready_for_review",
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      return { status: "ready_for_review", workflowRunId, outcome: initialOutcome };
    }

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
      const marketBootstrap = await bootstrapCompanyResearchContextV2Task.triggerAndWait(
        payload,
        {
          idempotencyKey: `bootstrap-company-research-context-v2:${payload.campaignRunId}`,
          tags: [
            `workspace:${payload.workspaceId}`,
            `campaign_run:${payload.campaignRunId}`,
          ],
        },
      );
      if (!marketBootstrap.ok) {
        throw new Error(
          `Market opportunity bootstrap failed: ${errorMessage(marketBootstrap.error)}`,
        );
      }
      if (marketBootstrap.output.status === "blocked") {
        const outcome = await settleTerminalOutcome(payload, "internal_cost_guard");
        await updateCampaignWorkflow({
          outputReference: {
            blockedStage: "market_research",
            stageOutput: marketBootstrap.output.outputReferences,
            ...(outcome ? { outcome } : {}),
          } as unknown as Json,
          status: "completed_partial",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return { status: "completed_partial", stage: "market_research", workflowRunId };
      }
    }

    for (const stage of stages) {
      const beforeStage = await consumeWorkflowControl({
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      if (beforeStage.state !== "run") {
        if (beforeStage.state === "cancelled")
          await settleTerminalOutcome(payload, "user_stopped");
        return { status: beforeStage.state, stage, workflowRunId };
      }
      const reachedBeforeStage = await settleReachedOutcome(payload);
      if (reachedBeforeStage) {
        await updateCampaignWorkflow({
          outputReference: { outcome: reachedBeforeStage } as unknown as Json,
          progressSummary: await progress(payload, completedStages),
          status: "ready_for_review",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return {
          status: "ready_for_review",
          stage,
          workflowRunId,
          outcome: reachedBeforeStage,
        };
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
          // A budget-blocked durable task is intentionally claimable again after
          // authorization. Scope Trigger deduplication to this parent execution;
          // the database task idempotency key still prevents duplicate writes.
          idempotencyKey: `campaign-v2:${workflowRunId}:cycle-${cycleNumber}:${stage}:parent-${ctx.run.id}`,
          tags: [
            `workspace:${payload.workspaceId}`,
            `campaign_run:${payload.campaignRunId}`,
            `workflow_run:${workflowRunId}`,
            `workflow_stage:${stage}`,
          ],
        },
      );
      if (!child.ok && isResearchBudgetError(child.error)) {
        const outcome = await settleTerminalOutcome(payload, "internal_cost_guard");
        await updateCampaignWorkflow({
          errorSummary: {
            code: "internal_cost_guard",
            message:
              "Research stopped safely and retained every strong company found so far.",
          },
          outputReference: {
            stoppedStage: stage,
            reason: "internal_cost_guard",
            outcome,
          },
          progressSummary: await progress(payload, completedStages, stage),
          status: "completed_partial",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return { status: "completed_partial", stage, workflowRunId, outcome };
      }
      if (!child.ok)
        throw new Error(
          `V2 Campaign child "${stage}" failed: ${errorMessage(child.error)}`,
        );
      if (child.output.status === "blocked") {
        const budgetBlocked = child.output.outputReferences.reason === "research_budget";
        const outcome = budgetBlocked
          ? await settleTerminalOutcome(payload, "internal_cost_guard")
          : null;
        await updateCampaignWorkflow({
          errorSummary: budgetBlocked
            ? {
                code: "internal_cost_guard",
                message:
                  "Research stopped safely and retained every strong company found so far.",
              }
            : null,
          outputReference: {
            blockedStage: stage,
            stageOutput: child.output.outputReferences,
            ...(outcome ? { outcome } : {}),
          } as unknown as Json,
          progressSummary: await progress(payload, completedStages, stage),
          status: "completed_partial",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return {
          status: "completed_partial",
          stage,
          workflowRunId,
          ...(outcome ? { outcome } : {}),
        };
      }
      completedStages.push(stage);
      const reachedAfterStage = await settleReachedOutcome(payload);
      if (reachedAfterStage) {
        await updateCampaignWorkflow({
          outputReference: {
            completedStages,
            outcome: reachedAfterStage,
          } as unknown as Json,
          progressSummary: await progress(payload, completedStages),
          status: "ready_for_review",
          workflowRunId,
          workspaceId: payload.workspaceId,
        });
        return {
          status: "ready_for_review",
          stage,
          workflowRunId,
          outcome: reachedAfterStage,
        };
      }
      const afterStage = await consumeWorkflowControl({
        workflowRunId,
        workspaceId: payload.workspaceId,
      });
      if (afterStage.state !== "run") {
        if (afterStage.state === "cancelled")
          await settleTerminalOutcome(payload, "user_stopped");
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
    const completionReason = continuationAction
      ? "internal_cost_guard"
      : completionReasonForAdaptiveAction(adaptiveDecision.action);
    const outcome = completionReason
      ? await settleTerminalOutcome(payload, completionReason)
      : null;
    await updateCampaignWorkflow({
      outputReference: {
        ...outputReference,
        adaptiveDecision,
        marketOverview,
        ...(outcome ? { outcome } : {}),
      } as unknown as Json,
      progressSummary: await progress(payload, completedStages),
      status:
        completionReason && completionReason !== "target_reached"
          ? "completed_partial"
          : "ready_for_review",
      workflowRunId,
      workspaceId: payload.workspaceId,
    });
    return {
      ...outputReference,
      adaptiveDecision,
      outcome,
      status:
        completionReason && completionReason !== "target_reached"
          ? "completed_partial"
          : "ready_for_review",
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

async function settleReachedOutcome(payload: ExecuteCampaignV2Payload) {
  const progress = await loadCompanyResearchOutcomeProgress(payload);
  if (!progress.targetReached) return null;
  if (progress.settled) return progress;
  const settlement = await finalizeCompanyResearchOutcome({
    workspaceId: payload.workspaceId,
    campaignRunId: payload.campaignRunId,
    completionReason: "target_reached",
  });
  return { ...progress, settlement };
}

async function settleTerminalOutcome(
  payload: ExecuteCampaignV2Payload,
  completionReason: CompanyResearchCompletionReason,
) {
  const progress = await loadCompanyResearchOutcomeProgress(payload);
  if (!progress.authorized) return null;
  if (progress.settled) return progress;
  const settlement = await finalizeCompanyResearchOutcome({
    workspaceId: payload.workspaceId,
    campaignRunId: payload.campaignRunId,
    completionReason,
  });
  return { ...progress, settlement };
}
