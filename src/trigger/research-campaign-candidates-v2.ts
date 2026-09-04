import { task } from "@trigger.dev/sdk";
import { executeCandidateResearchMember } from "@/server/candidate-research-v2/candidate-worker";
import { blockCandidateResearchMember } from "@/server/candidate-research-v2/repository";
import {
  finalizeCandidateResearchStage,
  prepareCandidateResearchStage,
} from "@/server/candidate-research-v2/stage-service";
import {
  DEFAULT_CANDIDATE_RESEARCH_WAVE_SIZE,
  partitionResearchWaves,
} from "@/lib/candidate-intelligence-v2/research-waves";
import { loadCompanyResearchOutcomeProgress } from "@/server/company-research/outcome-progress";

export type ResearchCampaignCandidateV2Payload = {
  campaignRunId: string;
  memberId: string;
  workspaceId: string;
};

export const researchCampaignCandidateV2Task = task({
  id: "research-campaign-candidate-v2",
  queue: {
    concurrencyLimit: 4,
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: ResearchCampaignCandidateV2Payload, { ctx }) => {
    try {
      return await executeCandidateResearchMember({
        memberId: payload.memberId,
        triggerRunId: ctx.run.id,
        workspaceId: payload.workspaceId,
      });
    } catch (error) {
      if (!isResearchBudgetError(error)) throw error;
      const message = errorMessage(error);
      const reason = /workspace credit balance|workspace balance/i.test(message)
        ? "workspace_balance"
        : "campaign_budget";
      await blockCandidateResearchMember({
        memberId: payload.memberId,
        workspaceId: payload.workspaceId,
        errorCode: `research_budget_${reason}`,
        errorMessage: message,
      });
      return {
        status: "budget_blocked" as const,
        memberId: payload.memberId,
        reason,
        message,
      };
    }
  },
});

export async function executeCandidateResearchFanOut(input: {
  campaignRunId: string;
  workspaceId: string;
  cycleNumber?: number;
  stageExecutionId: string;
}) {
  const initialOutcome = await loadCompanyResearchOutcomeProgress(input);
  if (initialOutcome.targetReached) return targetReachedResult(initialOutcome);
  const batch = await prepareCandidateResearchStage(input);
  const waves = partitionResearchWaves(
    batch.pendingMemberIds,
    DEFAULT_CANDIDATE_RESEARCH_WAVE_SIZE,
  );
  let budgetPause: {
    reason: "campaign_budget" | "workspace_balance";
    message: string;
  } | null = null;
  for (const [waveIndex, memberIds] of waves.entries()) {
    const outcome = await loadCompanyResearchOutcomeProgress(input);
    if (outcome.targetReached) return targetReachedResult(outcome);
    const results = await researchCampaignCandidateV2Task.batchTriggerAndWait(
      memberIds.map((memberId) => ({
        payload: {
          campaignRunId: input.campaignRunId,
          memberId,
          workspaceId: input.workspaceId,
        },
        options: {
          idempotencyKey: `candidate-research:${batch.batchId}:wave-${waveIndex + 1}:${memberId}:stage-${input.stageExecutionId}`,
          tags: [
            `workspace:${input.workspaceId}`,
            `campaign_run:${input.campaignRunId}`,
            `candidate_research_batch:${batch.batchId}`,
            `candidate_research_member:${memberId}`,
            `candidate_research_wave:${waveIndex + 1}`,
          ],
        },
      })),
    );
    const failed = results.runs.filter((run) => !run.ok);
    if (failed.length) {
      throw new Error(
        `${failed.length} V2 Candidate research child task(s) failed; completed candidate work remains cached. ${failed.map((run) => errorMessage(run.error)).join(" | ")}`,
      );
    }
    for (const run of results.runs) {
      if (!run.ok || !isBudgetBlockedOutput(run.output)) continue;
      budgetPause ??= {
        reason: run.output.reason,
        message: run.output.message,
      };
    }
  }
  const result = await finalizeCandidateResearchStage({
    batchId: batch.batchId,
    workspaceId: input.workspaceId,
  });
  return budgetPause
    ? {
        ...result,
        status: "blocked" as const,
        outputReferences: {
          ...result.outputReferences,
          triageSummary: batch.triageSummary,
          reason: "research_budget",
          pauseReason: budgetPause.reason,
          message: budgetPause.message,
        },
      }
    : {
        ...result,
        outputReferences: {
          ...result.outputReferences,
          triageSummary: batch.triageSummary,
        },
      };
}

function targetReachedResult(outcome: {
  requestedCompanyCount: number;
  deliveredCompanyCount: number;
}) {
  return {
    stage: "research_candidates" as const,
    status: "completed" as const,
    outputReferences: { reason: "target_reached", ...outcome },
    progressDelta: {},
    usageEventIds: [],
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isResearchBudgetError(error: unknown) {
  return /research credit authorization|workspace credit balance|research budget|actual usage exceeds/i.test(
    errorMessage(error),
  );
}

function isBudgetBlockedOutput(value: unknown): value is {
  status: "budget_blocked";
  reason: "campaign_budget" | "workspace_balance";
  message: string;
} {
  if (!value || typeof value !== "object") return false;
  const output = value as Record<string, unknown>;
  return (
    output.status === "budget_blocked" &&
    (output.reason === "campaign_budget" || output.reason === "workspace_balance") &&
    typeof output.message === "string"
  );
}
