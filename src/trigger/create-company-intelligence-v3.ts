import { task } from "@trigger.dev/sdk";
import {
  executeProfileV3Stage,
  failProfileV3Draft,
  finalizeProfileV3Draft,
  linkProfileV3TriggerRun,
  profileV3StageIds,
} from "@/server/company-profile-v3/stage-service";
import { runProfileV3Workflow } from "@/lib/intelligence/company-profile-v3/workflow";

export type CreateCompanyIntelligenceV3Payload = {
  workspaceId: string;
  profileDraftId: string;
};

export const createCompanyIntelligenceV3Task = task<
  "create-company-intelligence-v3",
  CreateCompanyIntelligenceV3Payload,
  {
    workspaceId: string;
    profileDraftId: string;
    state: "ready_for_review" | "needs_input";
    taskRunIds: string[];
    cachedStageIds: string[];
  }
>({
  id: "create-company-intelligence-v3",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({ payload, error }) =>
    failProfileV3Draft({
      workspaceId: payload.workspaceId,
      profileDraftId: payload.profileDraftId,
      error,
    }),
  run: async (payload: CreateCompanyIntelligenceV3Payload, { ctx }) => {
    await linkProfileV3TriggerRun({ ...payload, triggerRunId: ctx.run.id });
    const workflow = await runProfileV3Workflow({
      stageIds: profileV3StageIds,
      runStage: (taskId) =>
        executeProfileV3Stage({
          ...payload,
          taskId,
          triggerRunId: ctx.run.id,
        }),
      finalize: () => finalizeProfileV3Draft(payload),
    });
    return { ...payload, ...workflow };
  },
});
