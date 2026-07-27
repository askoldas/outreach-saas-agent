import type {
  DiscoveryProviderCapabilities,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResponse,
} from "@/lib/discovery-v2";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function persistProviderResponse(input: {
  workspaceId: string;
  campaignId: string;
  planKey: string;
  segmentKey: string;
  providerKey: string;
  adapterVersion: string;
  capabilities: DiscoveryProviderCapabilities;
  capabilitiesHash: string;
  executionKey: string;
  requestHash: string;
  request: ProviderDiscoveryRequest;
  response: ProviderDiscoveryResponse;
  normalizationVersion: string;
}) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc("persist_discovery_provider_response", {
    target_workspace_id: input.workspaceId,
    target_campaign_id: input.campaignId,
    target_plan_key: input.planKey,
    target_segment_key: input.segmentKey,
    target_provider_key: input.providerKey,
    target_adapter_version: input.adapterVersion,
    target_capabilities: input.capabilities as unknown as Json,
    target_capabilities_hash: input.capabilitiesHash,
    target_execution_key: input.executionKey,
    target_request_hash: input.requestHash,
    target_request: input.request as unknown as Json,
    target_response: input.response as unknown as Json,
    target_normalization_version: input.normalizationVersion,
  });
  if (error)
    throw new Error(`Could not persist Discovery provider response: ${error.message}`);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Discovery provider persistence returned an invalid execution.");
  }
  return data as Record<string, unknown>;
}
