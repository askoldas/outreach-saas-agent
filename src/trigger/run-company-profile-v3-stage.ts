import { task } from "@trigger.dev/sdk";
import {
  executeProfileV3Stage,
  type ProfileV3StageId,
} from "@/server/company-profile-v3/stage-service";

export type RunCompanyProfileV3StagePayload = {
  workspaceId: string;
  profileDraftId: string;
  taskId: ProfileV3StageId;
};

export const runCompanyProfileV3StageTask = task({
  id: "run-company-profile-v3-stage",
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  run: (payload: RunCompanyProfileV3StagePayload, { ctx }) =>
    executeProfileV3Stage({ ...payload, triggerRunId: ctx.run.id }),
});
