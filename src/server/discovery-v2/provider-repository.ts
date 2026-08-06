import type {
  DiscoveryProviderCapabilities,
  ProviderDiscoveryRequest,
  ProviderDiscoveryResponse,
} from "@/lib/discovery-v2";
import { CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION } from "@/lib/discovery-v2/candidate-preclassification-model";
import type { AiCallResult } from "@/lib/providers/openrouter";
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

export async function recordCandidatePreclassificationModelCall(input: {
  workspaceId: string;
  campaignId: string;
  segmentId: string;
  requestHash: string;
  call: AiCallResult<string>;
}) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("ai_requests").insert({
    workspace_id: input.workspaceId,
    role: "search_result_classification",
    provider: "openrouter",
    selected_model: input.call.requestedModel,
    fallback_model: input.call.fallbackUsed
      ? (input.call.actualModel ?? input.call.requestedModel)
      : null,
    fallback_used: input.call.fallbackUsed,
    prompt_version: CANDIDATE_PRECLASSIFICATION_PROMPT_VERSION,
    schema_version: "candidate-preclassification-schema/v1.0",
    request_hash: input.requestHash,
    status: "completed",
    input_units: input.call.inputTokens ?? null,
    output_units: input.call.outputTokens ?? null,
    actual_cost: input.call.providerReportedCost ?? 0,
    currency: input.call.providerCurrency ?? "USD",
    metadata: {
      actualModel: input.call.actualModel,
      campaignId: input.campaignId,
      latencyMs: input.call.latencyMs,
      providerRequestId: input.call.providerRequestId,
      segmentId: input.segmentId,
    },
    completed_at: new Date().toISOString(),
  });
  if (error) {
    throw new Error(`Could not audit candidate preclassification: ${error.message}`);
  }
}

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
  const { data: classifications, error: classificationError } = await supabase
    .from("provider_candidate_preclassifications_v2")
    .select(
      "provider_source_record_id,disposition,objective_compatibility,geography_plausible",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("provider_execution_id", execution.id);
  if (classificationError) {
    throw new Error(
      `Could not inspect cached candidate preclassifications: ${classificationError.message}`,
    );
  }
  return {
    cached: true,
    completedAt: new Date(execution.completed_at ?? execution.started_at).toISOString(),
    coverage: summarizePersistedProviderCoverage({
      sources: sources ?? [],
      candidates,
      classifications: classifications ?? [],
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
  const execution = data as Record<string, unknown>;
  const executionId = String(execution.id ?? "");
  if (!executionId) {
    throw new Error("Discovery provider persistence omitted its execution ID.");
  }
  const { error: classificationError } = await database.rpc(
    "persist_provider_candidate_preclassifications_v2",
    {
      target_workspace_id: input.workspaceId,
      target_execution_id: executionId,
      target_classifications: input.response.classifications as unknown as Json,
    },
  );
  if (classificationError) {
    throw new Error(
      `Could not persist candidate preclassifications: ${classificationError.message}`,
    );
  }
  return execution;
}

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
