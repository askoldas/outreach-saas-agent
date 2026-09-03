import { task } from "@trigger.dev/sdk";
import { executeCompanyResearchBootstrap } from "@/server/market-analysis-v2/stage-service";
import { recordResearchBudgetPause } from "@/server/workflow-v2/repository";

export type BootstrapCompanyResearchContextV2Payload = {
  campaignRunId: string;
  workspaceId: string;
};

// This enrichment is deliberately outside the blocking discovery stage chain.
// Its persistence and provider accounting are idempotent, so Trigger retries and
// workflow resumes can safely converge on the same run-tied artifacts.
export const bootstrapCompanyResearchContextV2Task = task({
  id: "bootstrap-company-research-context-v2",
  retry: { maxAttempts: 3 },
  run: async (payload: BootstrapCompanyResearchContextV2Payload) => {
    try {
      return await executeCompanyResearchBootstrap(payload);
    } catch (error) {
      const reason = researchBudgetPauseReason(error);
      if (!reason) throw error;
      await recordResearchBudgetPause({
        campaignRunId: payload.campaignRunId,
        reason,
        workspaceId: payload.workspaceId,
      });
      return {
        stage: "initialize" as const,
        status: "blocked" as const,
        outputReferences: {
          reason: "research_budget",
          pauseReason: reason,
          message:
            error instanceof Error
              ? error.message
              : "Company Research budget is unavailable.",
        },
        progressDelta: {},
        usageEventIds: [],
      };
    }
  },
});

function researchBudgetPauseReason(
  error: unknown,
): "campaign_budget" | "workspace_balance" | null {
  const message = error instanceof Error ? error.message : String(error);
  if (/workspace credit balance|workspace balance/i.test(message))
    return "workspace_balance";
  if (/research credit authorization|campaign research credit|research budget/i.test(message))
    return "campaign_budget";
  return null;
}
