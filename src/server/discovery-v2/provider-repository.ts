import type {
  DiscoveryProviderCapabilities,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResponse,
} from "@/lib/discovery-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import {
  summarizePersistedProviderCoverage,
  type PersistedProviderCandidateFact,
  type PersistedProviderCoverageSummary,
} from "./provider-coverage";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export type PersistedProviderExecutionSummary = {
  cached: true;
  completedAt: string;
  coverage: PersistedProviderCoverageSummary;
  errors: Json;
  exhausted: boolean;
  executionId: string;
  normalizedCandidateCount: number;
  providerRecordCount: number;
  usage: Json;
  warnings: Json;
};

export async function findPersistedProviderExecution(input: {
  workspaceId: string;
  campaignId: string;
  segmentKey: string;
  providerKey: string;
  adapterVersion: string;
  requestHash: string;
}): Promise<PersistedProviderExecutionSummary | null> {
  const supabase = createServiceRoleClient();
  const { data: execution, error } = await supabase
    .from("discovery_provider_executions")
    .select(
      "id,result_count,exhausted,errors_json,warnings_json,usage_json,started_at,completed_at",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .eq("discovery_segment_key", input.segmentKey)
    .eq("provider_key", input.providerKey)
    .eq("adapter_version", input.adapterVersion)
    .eq("request_hash", input.requestHash)
    .eq("status", "completed")
    .maybeSingle();
  if (error)
    throw new Error(`Could not inspect Discovery provider cache: ${error.message}`);
  if (!execution) return null;

  const { data: sources, error: sourceError } = await supabase
    .from("provider_source_records")
    .select("id,ingestion_status,query_or_filter_fingerprint,source_type")
    .eq("workspace_id", input.workspaceId)
    .eq("provider_execution_id", execution.id);
  if (sourceError)
    throw new Error(`Could not inspect cached Discovery records: ${sourceError.message}`);
  const sourceIds = (sources ?? []).map(({ id }) => id);
  const candidates: PersistedProviderCandidateFact[] = [];
  if (sourceIds.length) {
    for (const sourceIdBatch of batches(sourceIds, 200)) {
      const { data, error: candidateError } = await supabase
        .from("normalized_provider_candidates")
        .select("provider_source_record_id,canonical_domain_hint,normalized_name,name")
        .eq("workspace_id", input.workspaceId)
        .in("provider_source_record_id", sourceIdBatch);
      if (candidateError)
        throw new Error(
          `Could not inspect cached normalized candidates: ${candidateError.message}`,
        );
      candidates.push(...(data ?? []));
    }
  }
  return {
    cached: true,
    completedAt: new Date(execution.completed_at ?? execution.started_at).toISOString(),
    coverage: summarizePersistedProviderCoverage({
      sources: sources ?? [],
      candidates,
    }),
    errors: execution.errors_json,
    exhausted: execution.exhausted === true,
    executionId: execution.id,
    normalizedCandidateCount: candidates.length,
    providerRecordCount: execution.result_count,
    usage: execution.usage_json,
    warnings: execution.warnings_json,
  };
}

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
  const supabase = createServiceRoleClient();
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

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
