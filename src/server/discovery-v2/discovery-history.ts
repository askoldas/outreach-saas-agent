import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import {
  summarizePersistedProviderCoverage,
  type ProviderExecutionCoverageFacts,
} from "./provider-coverage";

export type DiscoverySegmentHistory = {
  completedAt?: string;
  executionIds: string[];
  previousProviderIds: string[];
  previousQueryFingerprints: string[];
  coverageFacts: ProviderExecutionCoverageFacts;
};

export async function loadDiscoverySegmentHistory(input: {
  workspaceId: string;
  runId: string;
  segmentId: string;
  maximumPassNumber?: number;
}): Promise<DiscoverySegmentHistory> {
  const supabase = createServiceRoleClient();
  let segmentRunQuery = supabase
    .from("discovery_segment_runs_v2")
    .select("id,pass_number")
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_run_id", input.runId)
    .eq("discovery_segment_id", input.segmentId)
    .order("pass_number", { ascending: true });
  if (input.maximumPassNumber !== undefined) {
    segmentRunQuery = segmentRunQuery.lte("pass_number", input.maximumPassNumber);
  }
  const { data: segmentRuns, error: segmentRunError } = await segmentRunQuery;
  if (segmentRunError) {
    throw new Error(
      `Could not load Discovery Segment history: ${segmentRunError.message}`,
    );
  }
  if (!segmentRuns?.length) return emptyHistory();

  const passNumberBySegmentRun = new Map(
    segmentRuns.map((segmentRun) => [segmentRun.id, segmentRun.pass_number]),
  );
  const segmentRunIds = segmentRuns.map(({ id }) => id);
  const { data: executions, error: executionError } = await supabase
    .from("discovery_provider_executions")
    .select(
      "id,discovery_segment_run_id,provider_key,status,result_count,exhausted,errors_json,usage_json,started_at,completed_at",
    )
    .eq("workspace_id", input.workspaceId)
    .in("discovery_segment_run_id", segmentRunIds)
    .eq("status", "completed");
  if (executionError) {
    throw new Error(
      `Could not load Discovery provider history: ${executionError.message}`,
    );
  }
  if (!executions?.length) return emptyHistory();

  const orderedExecutions = [...executions].sort(
    (left, right) =>
      (passNumberBySegmentRun.get(left.discovery_segment_run_id ?? "") ?? 0) -
        (passNumberBySegmentRun.get(right.discovery_segment_run_id ?? "") ?? 0) ||
      compareText(
        left.completed_at ?? left.started_at,
        right.completed_at ?? right.started_at,
      ) ||
      compareText(left.id, right.id),
  );
  const executionIds = orderedExecutions.map(({ id }) => id);
  const { data: queries, error: queryError } = await supabase
    .from("discovery_queries_v2")
    .select("provider_execution_id,fingerprint,language,query_type,status")
    .eq("workspace_id", input.workspaceId)
    .in("provider_execution_id", executionIds);
  if (queryError) {
    throw new Error(`Could not load Discovery query history: ${queryError.message}`);
  }
  const { data: sources, error: sourceError } = await supabase
    .from("provider_source_records")
    .select(
      "id,ingestion_status,query_or_filter_fingerprint,source_type,provider_execution_id",
    )
    .eq("workspace_id", input.workspaceId)
    .in("provider_execution_id", executionIds);
  if (sourceError) {
    throw new Error(`Could not load Discovery source history: ${sourceError.message}`);
  }
  const sourceIds = (sources ?? []).map(({ id }) => id);
  const candidates: Array<{
    canonical_domain_hint: string | null;
    name: string;
    normalized_name: string | null;
    provider_source_record_id: string;
  }> = [];
  for (const sourceIdBatch of batches(sourceIds, 200)) {
    const { data, error } = await supabase
      .from("normalized_provider_candidates")
      .select("provider_source_record_id,canonical_domain_hint,normalized_name,name")
      .eq("workspace_id", input.workspaceId)
      .in("provider_source_record_id", sourceIdBatch);
    if (error) {
      throw new Error(`Could not load normalized Discovery history: ${error.message}`);
    }
    candidates.push(...(data ?? []));
  }

  const coverage = summarizePersistedProviderCoverage({
    sources: sources ?? [],
    candidates,
  });
  const attemptedQueries = (queries ?? []).filter(({ status }) =>
    ["completed", "failed"].includes(status),
  );
  const latestExecution = orderedExecutions.at(-1);
  return {
    completedAt: new Date(
      latestExecution?.completed_at ?? latestExecution?.started_at,
    ).toISOString(),
    executionIds,
    previousProviderIds: sortedUnique(
      orderedExecutions.map(({ provider_key }) => provider_key),
    ),
    previousQueryFingerprints: sortedUnique(
      (queries ?? []).map(({ fingerprint }) => fingerprint),
    ),
    coverageFacts: {
      candidateIdentityHints: coverage.candidateIdentityHints,
      invalidRecordCount: coverage.invalidRecordCount,
      languagesAttempted: sortedUnique(attemptedQueries.map(({ language }) => language)),
      normalizedCandidates: candidates.length,
      providerCalls: orderedExecutions.reduce(
        (total, execution) =>
          total + nonnegativeInteger(jsonNumber(execution.usage_json, "calls")),
        0,
      ),
      providerExhausted: latestExecution?.exhausted === true,
      providerFailureCount: orderedExecutions.reduce(
        (total, execution) => total + jsonArray(execution.errors_json).length,
        0,
      ),
      queriesExecuted: attemptedQueries.length,
      queryFamiliesAttempted: sortedUnique(
        attemptedQueries.map(({ query_type }) => query_type),
      ),
      rawRecords: sources?.length ?? 0,
      sourceTypesAttempted: coverage.sourceTypes,
      uniqueCandidateHints: coverage.uniqueCandidateHintCount,
    },
  };
}

function emptyHistory(): DiscoverySegmentHistory {
  return {
    executionIds: [],
    previousProviderIds: [],
    previousQueryFingerprints: [],
    coverageFacts: {
      candidateIdentityHints: [],
      invalidRecordCount: 0,
      languagesAttempted: [],
      normalizedCandidates: 0,
      providerCalls: 0,
      providerExhausted: false,
      providerFailureCount: 0,
      queriesExecuted: 0,
      queryFamiliesAttempted: [],
      rawRecords: 0,
      sourceTypesAttempted: [],
      uniqueCandidateHints: 0,
    },
  };
}

function jsonArray(value: Json) {
  return Array.isArray(value) ? value : [];
}

function jsonNumber(value: Json, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Number(value[key]);
}

function nonnegativeInteger(value: number) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function batches<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
