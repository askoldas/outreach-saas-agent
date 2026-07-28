import { task } from "@trigger.dev/sdk";
import { executeQualificationMember } from "@/server/qualification-v2/candidate-worker";
import { blockQualificationMember } from "@/server/qualification-v2/repository";
import {
  finalizeQualificationStage,
  prepareQualificationStage,
} from "@/server/qualification-v2/stage-service";

export type QualifyCampaignCandidateV2Payload = {
  campaignRunId: string;
  memberId: string;
  workspaceId: string;
};

export const qualifyCampaignCandidateV2Task = task({
  id: "qualify-campaign-candidate-v2",
  queue: {
    concurrencyLimit: 4,
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  onFailure: async ({
    payload,
    error,
  }: {
    payload: QualifyCampaignCandidateV2Payload;
    error: unknown;
  }) => {
    await blockQualificationMember({
      memberId: payload.memberId,
      workspaceId: payload.workspaceId,
      errorCode: errorCode(error),
      errorMessage: errorMessage(error),
    });
  },
  run: (payload: QualifyCampaignCandidateV2Payload, { ctx }) =>
    executeQualificationMember({
      memberId: payload.memberId,
      triggerRunId: ctx.run.id,
      workspaceId: payload.workspaceId,
    }),
});

export async function executeQualificationFanOut(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const batch = await prepareQualificationStage(input);
  if (batch.pendingMemberIds.length) {
    const requests = batch.pendingMemberIds.map((memberId) => ({
      payload: {
        campaignRunId: input.campaignRunId,
        memberId,
        workspaceId: input.workspaceId,
      },
      options: {
        idempotencyKey: `candidate-qualification:${batch.batchId}:${memberId}`,
        tags: [
          `workspace:${input.workspaceId}`,
          `campaign_run:${input.campaignRunId}`,
          `candidate_qualification_batch:${batch.batchId}`,
          `candidate_qualification_member:${memberId}`,
        ],
      },
    }));
    const results = await qualifyCampaignCandidateV2Task.batchTriggerAndWait(requests);
    for (const [index, run] of results.runs.entries()) {
      if (run.ok) continue;
      const memberId = batch.pendingMemberIds[index];
      if (!memberId) continue;
      await blockQualificationMember({
        memberId,
        workspaceId: input.workspaceId,
        errorCode: errorCode(run.error),
        errorMessage: errorMessage(run.error),
      });
    }
  }
  return finalizeQualificationStage({
    batchId: batch.batchId,
    workspaceId: input.workspaceId,
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Qualification V2 failure";
}

function errorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "qualification_member_failed";
}
