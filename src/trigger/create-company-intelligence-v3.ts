import { task } from "@trigger.dev/sdk";
import {
  failProfileV3Draft,
  finalizeProfileV3Draft,
  profileV3StageIds,
} from "@/server/company-profile-v3/stage-service";
import { runProfileV3Workflow } from "@/lib/intelligence/company-profile-v3/workflow";
import { runCompanyProfileV3StageTask } from "./run-company-profile-v3-stage";

export type CreateCompanyIntelligenceV3Payload = {
  workspaceId: string;
  profileDraftId: string;
};

export const createCompanyIntelligenceV3Task = task({
  id: "create-company-intelligence-v3",
  retry: {
    maxAttempts: 1,
  },
  onFailure: async ({ payload, error }) =>
    failProfileV3Draft({
      workspaceId: payload.workspaceId,
      profileDraftId: payload.profileDraftId,
      error,
    }),
  run: async (payload: CreateCompanyIntelligenceV3Payload) => {
    const workflow = await runProfileV3Workflow({
      stageIds: profileV3StageIds,
      runStage: async (taskId) => {
        const child = await runCompanyProfileV3StageTask.triggerAndWait(
          { ...payload, taskId },
          {
            idempotencyKey: `profile-v3:${payload.profileDraftId}:${taskId}:v2`,
            tags: [
              `workspace:${payload.workspaceId}`,
              `profile_draft:${payload.profileDraftId}`,
              `profile_stage:${taskId}`,
            ],
          },
        );
        if (!child.ok)
          throw new Error(
            `Company Intelligence child ${taskId} failed: ${errorMessage(child.error)}`,
          );
        return {
          taskRunId: child.output.taskRunId,
          cached: child.output.cached,
        };
      },
      finalize: () => finalizeProfileV3Draft(payload),
    });
    return { ...payload, ...workflow };
  },
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown profile child failure";
}
