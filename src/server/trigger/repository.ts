import { tasks } from "@trigger.dev/sdk";
import type { verifyCampaignRunTask } from "@/trigger/verify-campaign-run";

export async function dispatchCampaignRunVerification(campaignRunId: string) {
  if (!campaignRunId) {
    throw new Error("Cannot dispatch Trigger.dev verification without a campaign run.");
  }

  return tasks.trigger<typeof verifyCampaignRunTask>(
    "verify-campaign-run",
    { campaignRunId },
    {
      idempotencyKey: `verify-campaign-run:${campaignRunId}`,
      tags: [`campaign_run:${campaignRunId}`],
    },
  );
}
