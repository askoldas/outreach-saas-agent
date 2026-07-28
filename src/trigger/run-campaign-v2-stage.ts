import { task } from "@trigger.dev/sdk";
import type { CampaignV2Stage } from "@/lib/workflow-v2/contracts";
import { executeCampaignV2Stage } from "@/server/workflow-v2/stage-service";
import { executeCandidateResearchFanOut } from "./research-campaign-candidates-v2";

export type RunCampaignV2StagePayload = {
  campaignRunId: string;
  stage: CampaignV2Stage;
  workflowRunId: string;
  workspaceId: string;
};

export const runCampaignV2StageTask = task({
  id: "run-campaign-v2-stage",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: (payload: RunCampaignV2StagePayload, { ctx }) =>
    executeCampaignV2Stage(
      { ...payload, triggerRunId: ctx.run.id },
      {
        researchCandidates: () => executeCandidateResearchFanOut(payload),
      },
    ),
});
