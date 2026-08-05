import {
  campaignMarketContextOutputSchema,
  campaignStrategyAdvisoryDeltaOutputSchema,
  campaignV2TaskContracts,
  compileCampaignStrategyV2,
  generateCampaignMarketContext,
  generateCampaignStrategyAdvisoryDelta,
  hashCanonical,
  mergeCampaignStrategyAdvisoryDelta,
} from "@/lib/intelligence/campaign-strategy-v2";
import { intelligenceResultCacheKey } from "@/lib/intelligence/runtime/cache-key";
import type { AiCallResult } from "@/lib/providers/openrouter";
import type { Json } from "@/types/database.types";
import { recordCampaignStrategyModelCalls, persistCampaignStrategyV2Compilation } from "./repository";
import { prepareCampaignStrategyV2Compilation } from "./service";
import {
  claimCampaignStrategyStage,
  completeCampaignStrategyStage,
  failCampaignStrategyStage,
  type CampaignStrategyStageId,
} from "./stage-repository";
import { campaignStrategyModelRouteVersion } from "./stage-contracts";
import { recordIntelligenceCacheHit } from "@/server/intelligence-runtime/event-repository";
import { createIntelligenceAttemptRecorder } from "@/server/intelligence-runtime/attempt-repository";

type CampaignStrategyModelStageId = Exclude<CampaignStrategyStageId, "baseline">;

export type CampaignStrategyStagePayload = {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
  stageId: CampaignStrategyModelStageId;
  triggerRunId: string;
  marketContext?: Json;
  advisoryDelta?: Json;
};

export async function executeCampaignStrategyStage(input: CampaignStrategyStagePayload) {
  const prepared = await prepareCampaignStrategyV2Compilation(input);
  const contract = stageContract(input.stageId);
  const dependencyInput =
    input.stageId === "compilation"
      ? {
          marketContext: input.marketContext,
          advisoryDelta: input.advisoryDelta,
        }
      : null;
  const frozenInputHash = hashCanonical({
    strategyDraftId: input.strategyDraftId,
    compiledContextHash: prepared.recovery.compiledContextHash,
    campaignInput: prepared.campaignInput,
    dependencyInput,
  });
  const cacheKey = intelligenceResultCacheKey({
    taskId: contract.taskId,
    frozenInputHash,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    contextCompilerVersion: contract.contextCompilerVersion,
    modelRouteVersion: campaignStrategyModelRouteVersion,
  });
  const claimed = await claimCampaignStrategyStage({
    workspaceId: input.workspaceId,
    strategyDraftId: input.strategyDraftId,
    stageId: input.stageId,
    cacheKey,
    inputHash: frozenInputHash,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    contextCompilerVersion: contract.contextCompilerVersion,
    modelRouteVersion: campaignStrategyModelRouteVersion,
    triggerRunId: input.triggerRunId,
  });
  if (claimed.status === "completed" && claimed.output !== null) {
    if (input.stageId !== "compilation") {
      await recordIntelligenceCacheHit({
        workspaceId: input.workspaceId,
        taskId: contract.taskId,
        cacheKey,
        metadata: { strategyDraftId: input.strategyDraftId, stageId: input.stageId },
      });
    }
    return { output: claimed.output, cached: true, stageRunId: claimed.id };
  }

  try {
    const output = await runStage(input, prepared, frozenInputHash);
    await completeCampaignStrategyStage({
      workspaceId: input.workspaceId,
      stageRunId: claimed.id,
      output,
    });
    return { output, cached: false, stageRunId: claimed.id };
  } catch (error) {
    await failCampaignStrategyStage({
      workspaceId: input.workspaceId,
      stageRunId: claimed.id,
      error,
    });
    throw error;
  }
}

async function runStage(
  input: CampaignStrategyStagePayload,
  prepared: Awaited<ReturnType<typeof prepareCampaignStrategyV2Compilation>>,
  frozenInputHash: string,
): Promise<Json> {
  if (input.stageId === "market_context") {
    const generated = await generateCampaignMarketContext({
      frozenContext: prepared.storedContext,
      campaignInput: prepared.campaignInput,
      runtime: { recordAttempt: attemptRecorder(input, frozenInputHash) },
    });
    await auditStageCall(input, frozenInputHash, {
      taskId: campaignV2TaskContracts.marketContext.taskId,
      promptVersion: campaignV2TaskContracts.marketContext.promptVersion,
      schemaVersion: campaignV2TaskContracts.marketContext.schemaVersion,
      output: generated.output,
      call: generated.call,
    });
    return generated.output as unknown as Json;
  }
  if (input.stageId === "advisory_delta") {
    const marketContext = campaignMarketContextOutputSchema.parse(input.marketContext);
    const generated = await generateCampaignStrategyAdvisoryDelta({
      frozenContext: prepared.storedContext,
      campaignInput: prepared.campaignInput,
      marketContext,
      runtime: { recordAttempt: attemptRecorder(input, frozenInputHash) },
    });
    await auditStageCall(input, frozenInputHash, {
      taskId: campaignV2TaskContracts.advisoryDelta.taskId,
      promptVersion: campaignV2TaskContracts.advisoryDelta.promptVersion,
      schemaVersion: campaignV2TaskContracts.advisoryDelta.schemaVersion,
      output: generated.output,
      call: generated.call,
    });
    return generated.output as unknown as Json;
  }
  campaignMarketContextOutputSchema.parse(input.marketContext);
  const advisoryDelta = campaignStrategyAdvisoryDeltaOutputSchema.parse(
    input.advisoryDelta,
  );
  const merged = mergeCampaignStrategyAdvisoryDelta({
    baseline: prepared.deterministicBase,
    advisory: advisoryDelta,
  });
  const compilation = compileCampaignStrategyV2({
    draft: merged.strategy,
    compiledContextHash: prepared.recovery.compiledContextHash,
  });
  await persistCampaignStrategyV2Compilation({
    workspaceId: input.workspaceId,
    strategyDraftId: input.strategyDraftId,
    compilation,
  });
  return {
    strategyDraftId: input.strategyDraftId,
    contentHash: compilation.contentHash,
    dispositions: merged.dispositions,
    dispositionSummary: {
      applied: merged.dispositions.filter((item) => item.status === "applied").length,
      rejected: merged.dispositions.filter((item) => item.status === "rejected").length,
      requiresUserReview: merged.dispositions.filter(
        (item) => item.status === "requires_user_review",
      ).length,
      omittedByBudget: advisoryDelta.omittedObservationCount,
    },
  } as Json;
}

function attemptRecorder(input: CampaignStrategyStagePayload, frozenInputHash: string) {
  return createIntelligenceAttemptRecorder({
    workspaceId: input.workspaceId,
    frozenInputHash,
    metadata: { strategyDraftId: input.strategyDraftId, stageId: input.stageId },
  });
}

async function auditStageCall(
  input: CampaignStrategyStagePayload,
  frozenInputHash: string,
  generated: {
    taskId: string;
    promptVersion: string;
    schemaVersion: string;
    output: unknown;
    call: AiCallResult<string>;
  },
) {
  await recordCampaignStrategyModelCalls({
    workspaceId: input.workspaceId,
    strategyDraftId: input.strategyDraftId,
    inputHash: frozenInputHash,
    calls: [
      {
        taskId: generated.taskId,
        promptVersion: generated.promptVersion,
        schemaVersion: generated.schemaVersion,
        outputHash: hashCanonical(generated.output),
        call: generated.call,
      },
    ],
  });
}

function stageContract(stageId: CampaignStrategyModelStageId) {
  if (stageId === "market_context") return campaignV2TaskContracts.marketContext;
  if (stageId === "advisory_delta") {
    return campaignV2TaskContracts.advisoryDelta;
  }
  return {
    taskId: "campaign.strategy_compilation",
    promptVersion: "campaign-strategy-deterministic-merge/v2",
    schemaVersion: "campaign-strategy-merge-dispositions/v2",
    contextCompilerVersion: "campaign-context/v2.2-market-specific",
  };
}
