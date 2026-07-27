import { task } from "@trigger.dev/sdk";
import {
  finalizeProfileV3Draft,
  profileV3StageIds,
} from "@/server/company-profile-v3/stage-service";
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
  run: async (payload: CreateCompanyIntelligenceV3Payload) => {
    const taskRunIds: string[] = [];
    for (const taskId of profileV3StageIds) {
      const child = await runCompanyProfileV3StageTask.triggerAndWait(
        { ...payload, taskId },
        {
          idempotencyKey: `profile-v3:${payload.profileDraftId}:${taskId}:v1`,
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
      taskRunIds.push(child.output.taskRunId);
    }
    const final = await finalizeProfileV3Draft(payload);
    return { ...payload, ...final, taskRunIds };
  },
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown profile child failure";
}
