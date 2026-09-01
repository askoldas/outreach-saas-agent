import { costUsdToCredits, getCreditEconomics } from "@/lib/credits/config";
import {
  releaseResearchCredits,
  reserveResearchCredits,
  settleResearchCredits,
} from "./repository";

export async function runBudgetedTavilyCall<T>(input: {
  workspaceId: string;
  campaignRunId: string;
  operation: string;
  idempotencyKey: string;
  estimatedProviderCredits: number;
  execute: () => Promise<T>;
  usage: (result: T) => {
    providerCredits: number;
    providerRequestId?: string;
    providerRequestIds?: string[];
  };
}) {
  const economics = getCreditEconomics();
  const estimatedCostUsd =
    input.estimatedProviderCredits * economics.tavilyProviderCreditCostUsd;
  const reservation = await reserveResearchCredits({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    operation: input.operation,
    idempotencyKey: input.idempotencyKey,
    estimatedCredits: Math.max(0.000001, costUsdToCredits(estimatedCostUsd)),
  });
  let result: T;
  try {
    result = await input.execute();
  } catch (error) {
    await releaseResearchCredits({
      workspaceId: input.workspaceId,
      campaignRunId: input.campaignRunId,
      reservationId: String(reservation.id),
      idempotencyKey: input.idempotencyKey,
      reason: error instanceof Error ? error.message : "Tavily call failed",
    });
    throw error;
  }
  const usage = input.usage(result);
  const actualCostUsd =
    usage.providerCredits * economics.tavilyProviderCreditCostUsd;
  await settleResearchCredits({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    reservationId: String(reservation.id),
    idempotencyKey: input.idempotencyKey,
    usage: {
      provider: "tavily",
      operation: input.operation,
      providerUnits: usage.providerCredits,
      ...(usage.providerRequestId
        ? { providerRequestId: usage.providerRequestId }
        : {}),
      actualCostUsd,
    },
    metadata: {
      providerUnit: "tavily_credit",
      providerCreditCostUsd: economics.tavilyProviderCreditCostUsd,
      providerRequestIds: usage.providerRequestIds ?? [],
    },
  });
  return result;
}
