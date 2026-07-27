import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export async function createDiscoveryPlan(input: {
  workspaceId: string;
  campaignId: string;
  strategyVersionId: string;
  memorySnapshotId: string;
  plan: Json;
  contentHash: string;
}) {
  return rpcRecord("create_discovery_plan_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_id: input.campaignId,
    target_strategy_version_id: input.strategyVersionId,
    target_memory_snapshot_id: input.memorySnapshotId,
    target_plan: input.plan,
    target_content_hash: input.contentHash,
  });
}

export async function startDiscoveryRun(input: { workspaceId: string; planId: string }) {
  return rpcRecord("start_discovery_run_v2", {
    target_workspace_id: input.workspaceId,
    target_plan_id: input.planId,
  });
}

export async function startDiscoverySegmentPass(input: {
  workspaceId: string;
  runId: string;
  segmentId: string;
  passNumber: number;
  gapIds: string[];
}) {
  return rpcRecord("start_discovery_segment_pass_v2", {
    target_workspace_id: input.workspaceId,
    target_run_id: input.runId,
    target_segment_id: input.segmentId,
    target_pass_number: input.passNumber,
    target_gap_ids: input.gapIds,
  });
}

export async function persistDiscoveryCoverageDecision(input: {
  workspaceId: string;
  runId: string;
  segmentRunId: string;
  coverage: Json;
  gaps: Json;
  decision: Json;
}) {
  return rpcRecord("persist_discovery_coverage_decision_v2", {
    target_workspace_id: input.workspaceId,
    target_run_id: input.runId,
    target_segment_run_id: input.segmentRunId,
    target_coverage: input.coverage,
    target_gaps: input.gaps,
    target_decision: input.decision,
  });
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
  return Number(data);
}

async function rpcRecord(name: string, args: Record<string, unknown>) {
  const data = await rpc(name, args);
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error(`${name} returned an invalid record.`);
  }
  return data as Record<string, unknown>;
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
