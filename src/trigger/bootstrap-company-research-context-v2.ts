import { task } from "@trigger.dev/sdk";
import { executeCompanyResearchBootstrap } from "@/server/market-analysis-v2/stage-service";

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
  run: (payload: BootstrapCompanyResearchContextV2Payload) =>
    executeCompanyResearchBootstrap(payload),
});
