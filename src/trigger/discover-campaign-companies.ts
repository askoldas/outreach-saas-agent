import { task } from "@trigger.dev/sdk";
import { executeCampaignDiscovery } from "@/server/campaign-discovery/service";
import {
  finalizeProviderTaskFailure,
  runProviderTask,
} from "@/server/execution/run-provider-task";
import type { CampaignAgentPlan } from "@/lib/campaign-agent/loop";

export type DiscoverCampaignCompaniesPayload = {
  plan?: CampaignAgentPlan;
  providerExecutionId: string;
};

export const discoverCampaignCompaniesTask = task<
  "discover-campaign-companies",
  DiscoverCampaignCompaniesPayload,
  Awaited<ReturnType<typeof executeCampaignDiscovery>>
>({
  id: "discover-campaign-companies",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 10_000,
    maxTimeoutInMs: 60_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({ payload, error }) =>
    finalizeProviderTaskFailure(payload.providerExecutionId, "campaign_discovery", error),
  run: async (payload: DiscoverCampaignCompaniesPayload, { ctx }) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "campaign_discovery", ctx, () =>
      executeCampaignDiscovery(payload.providerExecutionId, payload.plan),
    );
  },
});
