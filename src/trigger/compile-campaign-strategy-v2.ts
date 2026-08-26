import { task } from "@trigger.dev/sdk";
import { failCampaignStrategyV2Draft } from "@/server/campaign-strategy-v2/repository";
import { runCampaignStrategyV2StageTask } from "./run-campaign-strategy-v2-stage";

export type CompileCampaignStrategyV2Payload = {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
};

export const compileCampaignStrategyV2Task = task({
  id: "compile-campaign-strategy-v2",
  retry: {
    maxAttempts: 1,
  },
  onFailure: async ({
    payload,
    error,
  }: {
    payload: CompileCampaignStrategyV2Payload;
    error: unknown;
  }) =>
    failCampaignStrategyV2Draft({
      workspaceId: payload.workspaceId,
      strategyDraftId: payload.strategyDraftId,
      error,
    }),
  run: async (payload: CompileCampaignStrategyV2Payload, { ctx }) => {
    const childOptions = (stageId: string) => ({
      idempotencyKey: `strategy-stage:${payload.strategyDraftId}:${stageId}:${ctx.run.id}`,
      tags: [
        `workspace:${payload.workspaceId}`,
        `strategy_draft:${payload.strategyDraftId}`,
        `strategy_stage:${stageId}`,
      ],
    });
    const advisory = await runCampaignStrategyV2StageTask.triggerAndWait(
      { ...payload, stageId: "advisory_delta" },
      childOptions("advisory_delta"),
    );
    if (!advisory.ok) {
      throw new Error(
        `Campaign advisory-delta stage failed: ${errorMessage(advisory.error)}`,
      );
    }
    const compilation = await runCampaignStrategyV2StageTask.triggerAndWait(
      {
        ...payload,
        stageId: "compilation",
        advisoryDelta: advisory.output.output,
      },
      childOptions("compilation"),
    );
    if (!compilation.ok) {
      throw new Error(
        `Campaign Strategy compilation stage failed: ${errorMessage(compilation.error)}`,
      );
    }
    return {
      ...payload,
      advisoryCached: advisory.output.cached,
      compilationCached: compilation.output.cached,
    };
  },
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown Strategy stage failure.";
}
