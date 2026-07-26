import { task } from "@trigger.dev/sdk";
import { executeDraftGeneration } from "@/server/draft-generation/service";
import { runProviderTask } from "@/server/execution/run-provider-task";

export type GenerateOutreachDraftPayload = {
  providerExecutionId: string;
};

export const generateOutreachDraftTask = task({
  id: "generate-outreach-draft",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: GenerateOutreachDraftPayload) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "draft_generation", () =>
      executeDraftGeneration(payload.providerExecutionId),
    );
  },
});
