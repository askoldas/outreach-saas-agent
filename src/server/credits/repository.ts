import { createServiceRoleClient } from "@/lib/supabase/service";
import { researchBudgetStateSchema, type ProviderUsage } from "@/lib/credits/contracts";
import { costUsdToCredits } from "@/lib/credits/config";
import type { Json } from "@/types/database.types";
import {
  companyResearchQuoteSchema,
  companyResearchSettlementSchema,
  type CompanyResearchQuote,
} from "@/lib/company-research/outcome-pricing";
import type { CompanyResearchCompletionReason } from "@/lib/company-research/outcome";

type RpcResult = { data: unknown; error: { message: string } | null };

export async function reserveResearchCredits(input: {
  workspaceId: string;
  campaignRunId: string;
  operation: string;
  idempotencyKey: string;
  estimatedCredits: number;
}) {
  const result = await rpc("reserve_research_credits", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_operation: input.operation,
    target_idempotency_key: input.idempotencyKey,
    target_estimated_credits: input.estimatedCredits,
  });
  if (result.granted === false) {
    throw new ResearchBudgetPausedError(
      String(result.message ?? "Research budget is unavailable."),
      String(result.reason ?? "research_budget"),
    );
  }
  return result;
}

export class ResearchBudgetPausedError extends Error {
  readonly code = "research_budget_paused";
  readonly retryable = false;
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "ResearchBudgetPausedError";
  }
}

export async function settleResearchCredits(input: {
  workspaceId: string;
  campaignRunId: string;
  reservationId: string;
  idempotencyKey: string;
  usage: ProviderUsage;
  billableCostUsd?: number;
  companyId?: string;
  metadata?: Json;
}) {
  const billableCostUsd = input.billableCostUsd ?? input.usage.actualCostUsd;
  return rpc("settle_research_credits", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_reservation_id: input.reservationId,
    target_idempotency_key: input.idempotencyKey,
    target_provider: input.usage.provider,
    target_operation: input.usage.operation,
    target_model: input.usage.model ?? null,
    target_provider_request_id: input.usage.providerRequestId ?? null,
    target_raw_usage: input.usage as unknown as Json,
    target_actual_cost_usd: input.usage.actualCostUsd,
    target_billable_cost_usd: billableCostUsd,
    target_opptium_credits: costUsdToCredits(billableCostUsd),
    target_company_id: input.companyId ?? null,
    target_metadata: input.metadata ?? {},
  });
}

export async function getResearchBudgetState(input: {
  workspaceId: string;
  campaignRunId: string;
}) {
  return researchBudgetStateSchema.parse(
    await rpc("get_research_budget_state", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
    }),
  );
}

export async function releaseResearchCredits(input: {
  workspaceId: string;
  campaignRunId: string;
  reservationId: string;
  idempotencyKey: string;
  reason: string;
}) {
  return rpc("release_research_credit_reservation", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_reservation_id: input.reservationId,
    target_idempotency_key: input.idempotencyKey,
    target_reason: input.reason,
  });
}

export async function authorizeCompanyResearchOutcome(input: {
  workspaceId: string;
  campaignRunId: string;
  quote: CompanyResearchQuote;
}) {
  const quote = companyResearchQuoteSchema.parse(input.quote);
  return rpc("authorize_company_research_outcome", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_quote: quote as unknown as Json,
  });
}

export async function finalizeCompanyResearchOutcome(input: {
  workspaceId: string;
  campaignRunId: string;
  completionReason: CompanyResearchCompletionReason;
}) {
  const result = await rpc("finalize_company_research_outcome_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_completion_reason: input.completionReason,
  });
  const { idempotent, ...settlement } = result;
  return {
    ...companyResearchSettlementSchema.parse(settlement),
    idempotent: idempotent === true,
  };
}

export async function increaseCompanyResearchTarget(input: {
  workspaceId: string;
  campaignRunId: string;
  quote: CompanyResearchQuote;
}) {
  const quote = companyResearchQuoteSchema.parse(input.quote);
  const result = await rpc("increase_company_research_target", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_quote: quote as unknown as Json,
  });
  return {
    campaignRunId: String(result.campaignRunId),
    requestedCompanyCount: Number(result.requestedCompanyCount),
    incrementalAuthorizedCredits: Number(result.incrementalAuthorizedCredits),
    cycleNumber: Number(result.cycleNumber),
    requestedAction: String(result.requestedAction) as
      | "research_existing_pool"
      | "discover_more",
    idempotent: result.idempotent === true,
  };
}

async function rpc(name: string, args: Record<string, unknown>) {
  const client = createServiceRoleClient() as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`Research credit operation failed: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${name} returned an invalid result.`);
  }
  return data as Record<string, Json>;
}
