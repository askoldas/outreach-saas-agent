import { costUsdToCredits } from "@/lib/credits/config";
import type { AiCallResult } from "@/lib/providers/openrouter";
import {
  releaseResearchCredits,
  reserveResearchCredits,
  settleResearchCredits,
} from "./repository";

const MODEL_CALL_RESERVATION_CREDITS = 1;

export async function runBudgetedOpenRouterCall<T>(input: {
  workspaceId: string;
  campaignRunId: string;
  companyId?: string;
  operation: string;
  idempotencyKey: string;
  billable?: boolean;
  execute: () => Promise<AiCallResult<T>>;
}) {
  const reservation = await reserveResearchCredits({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    estimatedCredits: MODEL_CALL_RESERVATION_CREDITS,
  });
  let call: AiCallResult<T>;
  try {
    call = await input.execute();
  } catch (error) {
    await releaseResearchCredits({
      workspaceId: input.workspaceId,
      campaignRunId: input.campaignRunId,
      reservationId: String(reservation.id),
      idempotencyKey: input.idempotencyKey,
      reason: error instanceof Error ? error.message : "OpenRouter call failed",
    });
    throw error;
  }
  const actualCostUsd = call.providerReportedCost ?? 0;
  const billableCostUsd =
    input.billable === false
      ? 0
      : (call.providerReportedBillableCost ?? actualCostUsd);
  await settleResearchCredits({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    reservationId: String(reservation.id),
    idempotencyKey: input.idempotencyKey,
    companyId: input.companyId,
    usage: {
      provider: "openrouter",
      operation: input.operation,
      model: call.actualModel ?? call.requestedModel,
      ...(call.providerRequestId ? { providerRequestId: call.providerRequestId } : {}),
      ...(call.inputTokens === undefined ? {} : { inputTokens: call.inputTokens }),
      ...(call.outputTokens === undefined ? {} : { outputTokens: call.outputTokens }),
      ...(call.reasoningTokens === undefined ? {} : { reasoningTokens: call.reasoningTokens }),
      ...(call.cachedTokens === undefined ? {} : { cachedTokens: call.cachedTokens }),
      actualCostUsd,
    },
    billableCostUsd,
    metadata: {
      reservedCredits: MODEL_CALL_RESERVATION_CREDITS,
      settledCredits: costUsdToCredits(billableCostUsd),
      technicalRetry: input.billable === false,
    },
  });
  return call;
}
