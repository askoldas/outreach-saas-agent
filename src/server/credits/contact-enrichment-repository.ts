import { createServiceRoleClient } from "@/lib/supabase/service";
import { costUsdToCredits } from "@/lib/credits/config";

type RpcResult = { data: unknown; error: { message: string } | null };

export async function authorizeContactEnrichmentCredits(input: {
  workspaceId: string;
  campaignRunId: string;
  campaignCompanyId: string;
  idempotencyKey: string;
  maxCredits: number;
}) {
  return rpc("authorize_contact_enrichment_credits", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_campaign_company_id: input.campaignCompanyId,
    target_idempotency_key: input.idempotencyKey,
    target_max_credits: input.maxCredits,
  });
}

export async function settleContactEnrichmentCredits(input: {
  workspaceId: string;
  authorizationId: string;
  idempotencyKey: string;
  providerRequestId?: string;
  rawUsage: Record<string, unknown>;
  actualCostUsd: number;
  metadata?: Record<string, unknown>;
}) {
  return rpc("settle_contact_enrichment_credits", {
    target_workspace_id: input.workspaceId,
    target_authorization_id: input.authorizationId,
    target_idempotency_key: input.idempotencyKey,
    target_provider_request_id: input.providerRequestId ?? null,
    target_raw_usage: input.rawUsage,
    target_actual_cost_usd: input.actualCostUsd,
    target_billable_cost_usd: input.actualCostUsd,
    target_opptium_credits: costUsdToCredits(input.actualCostUsd),
    target_metadata: input.metadata ?? {},
  });
}

export async function releaseContactEnrichmentCredits(input: {
  workspaceId: string;
  authorizationId: string;
  idempotencyKey: string;
  reason: string;
}) {
  return rpc("release_contact_enrichment_credits", {
    target_workspace_id: input.workspaceId,
    target_authorization_id: input.authorizationId,
    target_idempotency_key: input.idempotencyKey,
    target_reason: input.reason,
  });
}

async function rpc(name: string, args: Record<string, unknown>) {
  const client = createServiceRoleClient() as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await client.rpc(name, args);
  if (error)
    throw new Error(`Contact Enrichment credit operation failed: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error(`${name} returned an invalid result.`);
  return data as Record<string, unknown>;
}
