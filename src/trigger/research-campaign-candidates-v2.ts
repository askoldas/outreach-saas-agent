import { task } from "@trigger.dev/sdk";
import { executeCandidateResearchMember } from "@/server/candidate-research-v2/candidate-worker";
import {
  finalizeCandidateResearchStage,
  prepareCandidateResearchStage,
} from "@/server/candidate-research-v2/stage-service";

export type ResearchCampaignCandidateV2Payload = {
  campaignRunId: string;
  memberId: string;
  workspaceId: string;
};

export const researchCampaignCandidateV2Task = task({
  id: "research-campaign-candidate-v2",
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
  run: (payload: ResearchCampaignCandidateV2Payload, { ctx }) =>
    executeCandidateResearchMember({
      memberId: payload.memberId,
      triggerRunId: ctx.run.id,
      workspaceId: payload.workspaceId,
    }),
});

export async function executeCandidateResearchFanOut(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const batch = await prepareCandidateResearchStage(input);
  if (batch.pendingMemberIds.length) {
    const results = await researchCampaignCandidateV2Task.batchTriggerAndWait(
      batch.pendingMemberIds.map((memberId) => ({
        payload: {
          campaignRunId: input.campaignRunId,
          memberId,
          workspaceId: input.workspaceId,
        },
        options: {
          idempotencyKey: `candidate-research:${batch.batchId}:${memberId}`,
          tags: [
            `workspace:${input.workspaceId}`,
            `campaign_run:${input.campaignRunId}`,
            `candidate_research_batch:${batch.batchId}`,
            `candidate_research_member:${memberId}`,
          ],
        },
      })),
    );
    const failed = results.runs.filter((run) => !run.ok);
    if (failed.length) {
      throw new Error(
        `${failed.length} V2 Candidate research child task(s) failed; completed candidate work remains cached.`,
      );
    }
  }
  return finalizeCandidateResearchStage({
    batchId: batch.batchId,
    workspaceId: input.workspaceId,
  });
}
