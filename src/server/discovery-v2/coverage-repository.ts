import { createServiceRoleClient } from "@/lib/supabase/service";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import type { Json } from "@/types/database.types";
import { z } from "zod";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const recordSchema = z.object({ id: z.string().min(1) }).passthrough();

const discoveryPlanRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  campaign_run_id: z.string().min(1),
  campaign_id: z.string().min(1),
  campaign_strategy_version_id: z.string().min(1),
  memory_snapshot_id: z.string().min(1),
  compiled_snapshot_json: z.unknown(),
  content_hash: z.string().length(64),
});

export type CampaignDiscoveryPlanRecord = z.infer<typeof discoveryPlanRecordSchema>;

const discoveryPlanSegmentSchema = z
  .object({
    id: z.string().min(1),
    segment_key: z.string().min(1),
    priority: z.number().int().min(1).max(100),
  })
  .strict();

const discoveryQueryPlanRecordSchema = recordSchema.extend({
  workspace_id: z.string().min(1),
  discovery_segment_run_id: z.string().min(1),
  provider_key: z.string().min(1),
  adapter_version: z.string().min(1),
  request_json: z.record(z.string(), z.unknown()),
  queries_json: z.array(z.unknown()),
  content_hash: z.string().length(64),
});

export type FrozenDiscoveryQueryPlanRecord = z.infer<
  typeof discoveryQueryPlanRecordSchema
>;

export async function createCampaignDiscoveryPlan(input: {
  workspaceId: string;
  campaignRunId: string;
  plan: Json;
  contentHash: string;
}) {
  return discoveryPlanRecordSchema.parse(
    await rpc("create_campaign_discovery_plan_v2", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
      target_plan: input.plan,
      target_content_hash: input.contentHash,
    }),
  );
}

export async function loadCampaignDiscoveryPlan(input: {
  workspaceId: string;
  campaignRunId: string;
}): Promise<CampaignDiscoveryPlanRecord | null> {
  const data = await rpc("load_campaign_discovery_plan_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
  });
  return data === null ? null : discoveryPlanRecordSchema.parse(data);
}

export async function startCampaignDiscoveryRun(input: {
  workspaceId: string;
  campaignRunId: string;
  planId: string;
}) {
  return recordSchema.parse(
    await rpc("start_campaign_discovery_run_v2", {
      target_workspace_id: input.workspaceId,
      target_plan_id: input.planId,
      target_campaign_run_id: input.campaignRunId,
    }),
  );
}

export async function freezeDiscoveryQueryPlan(input: {
  workspaceId: string;
  segmentRunId: string;
  providerId: string;
  providerVersion: string;
  request: unknown;
  queries: unknown;
}) {
  const request = z.record(z.string(), z.unknown()).parse(input.request);
  const queries = z.array(z.unknown()).parse(input.queries);
  const record = discoveryQueryPlanRecordSchema.parse(
    await rpc("freeze_discovery_query_plan_v2", {
      target_workspace_id: input.workspaceId,
      target_segment_run_id: input.segmentRunId,
      target_provider_key: input.providerId,
      target_adapter_version: input.providerVersion,
      target_request: request,
      target_queries: queries,
      target_content_hash: hashCanonical({
        providerId: input.providerId,
        providerVersion: input.providerVersion,
        request,
        queries,
      }),
    }),
  );
  const frozenHash = hashCanonical({
    providerId: record.provider_key,
    providerVersion: record.adapter_version,
    request: record.request_json,
    queries: record.queries_json,
  });
  if (
    record.workspace_id !== input.workspaceId ||
    record.discovery_segment_run_id !== input.segmentRunId ||
    record.provider_key !== input.providerId ||
    record.adapter_version !== input.providerVersion ||
    record.content_hash !== frozenHash
  ) {
    throw new Error("Frozen Semantic Discovery query plan identity mismatch.");
  }
  return record;
}

export async function listDiscoveryPlanSegments(input: {
  workspaceId: string;
  planId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("discovery_segments_v2")
    .select("id,segment_key,priority")
    .eq("workspace_id", input.workspaceId)
    .eq("discovery_plan_id", input.planId)
    .order("priority", { ascending: true })
    .order("segment_key", { ascending: true });
  if (error)
    throw new Error(`Could not load Semantic Discovery segments: ${error.message}`);
  return z.array(discoveryPlanSegmentSchema).parse(data ?? []);
}

export async function startDiscoverySegmentPassOnce(input: {
  workspaceId: string;
  runId: string;
  segmentId: string;
  passNumber: number;
  gapKeys: string[];
}) {
  return recordSchema.parse(
    await rpc("start_discovery_segment_pass_once_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_segment_id: input.segmentId,
      target_pass_number: input.passNumber,
      target_gap_keys: input.gapKeys,
    }),
  );
}

export async function persistDiscoverySegmentCoverageOnce(input: {
  workspaceId: string;
  runId: string;
  segmentRunId: string;
  coverage: Json;
  gaps: Json;
}) {
  return recordSchema.parse(
    await rpc("persist_discovery_segment_coverage_once_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_segment_run_id: input.segmentRunId,
      target_coverage: input.coverage,
      target_gaps: input.gaps,
    }),
  );
}

export async function finalizeDiscoveryPass(input: {
  workspaceId: string;
  runId: string;
  passNumber: number;
  expectedSegmentRunIds: string[];
  coverageSummary: Json;
  usageSummary: Json;
  decision: Json;
}) {
  return recordSchema.parse(
    await rpc("finalize_discovery_pass_v2", {
      target_workspace_id: input.workspaceId,
      target_run_id: input.runId,
      target_pass_number: input.passNumber,
      target_expected_segment_run_ids: input.expectedSegmentRunIds,
      target_coverage_summary: input.coverageSummary,
      target_usage_summary: input.usageSummary,
      target_decision: input.decision,
    }),
  );
}

export async function recordDiscoveryQueryAudit(input: {
  workspaceId: string;
  providerExecutionId: string;
  segmentRunId: string;
  queries: Json;
}) {
  const data = await rpc("record_discovery_query_audit_v2", {
    target_workspace_id: input.workspaceId,
    target_provider_execution_id: input.providerExecutionId,
    target_segment_run_id: input.segmentRunId,
    target_queries: input.queries,
  });
  const count = Number(data);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error("Discovery query audit returned an invalid settlement count.");
  }
  return count;
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`Semantic Discovery persistence failed: ${error.message}`);
  return data;
}
