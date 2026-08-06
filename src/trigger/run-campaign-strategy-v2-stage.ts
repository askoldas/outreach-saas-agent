import { task } from "@trigger.dev/sdk";
import {
  executeCampaignStrategyStage,
  type CampaignStrategyStagePayload,
} from "@/server/campaign-strategy-v2/stage-service";

export type RunCampaignStrategyV2StagePayload = Omit<
  CampaignStrategyStagePayload,
  "triggerRunId"
>;

export const runCampaignStrategyV2StageTask = task({
  id: "run-campaign-strategy-v2-stage",
  retry: { maxAttempts: 1 },
  run: (payload: RunCampaignStrategyV2StagePayload, { ctx }) =>
    executeCampaignStrategyStage({ ...payload, triggerRunId: ctx.run.id }),
});
