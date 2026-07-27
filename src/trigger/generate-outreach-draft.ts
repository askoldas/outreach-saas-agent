import { task } from "@trigger.dev/sdk";
import { executeDraftGeneration } from "@/server/draft-generation/service";
import {
  finalizeProviderTaskFailure,
  runProviderTask,
} from "@/server/execution/run-provider-task";

export type GenerateOutreachDraftPayload = {
  providerExecutionId: string;
};

export const generateOutreachDraftTask = task<
  "generate-outreach-draft",
  GenerateOutreachDraftPayload,
  Awaited<ReturnType<typeof executeDraftGeneration>>
>({
  id: "generate-outreach-draft",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({ payload, error }) =>
    finalizeProviderTaskFailure(payload.providerExecutionId, "draft_generation", error),
  run: async (payload: GenerateOutreachDraftPayload, { ctx }) => {
    if (!payload.providerExecutionId) throw new Error("providerExecutionId is required.");
    return runProviderTask(payload.providerExecutionId, "draft_generation", ctx, () =>
      executeDraftGeneration(payload.providerExecutionId),
    );
  },
});
