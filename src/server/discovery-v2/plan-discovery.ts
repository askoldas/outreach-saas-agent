import {
  compileDiscoveryPlanV2,
  discoveryPlanV2Schema,
  type DiscoveryPlanV2,
  type DiscoveryProviderCapabilities,
  type SegmentProviderRouteV2,
} from "@/lib/discovery-v2";
import {
  hashCanonical,
  type CampaignStrategyV2,
} from "@/lib/intelligence/campaign-strategy-v2";
import type { Json } from "@/types/database.types";
import {
  createCampaignDiscoveryPlan,
  type CampaignDiscoveryPlanRecord,
} from "./coverage-repository";

export function parsePersistedFrozenDiscoveryPlan(input: {
  record: CampaignDiscoveryPlanRecord;
  workspaceId: string;
  campaignRunId: string;
}): DiscoveryPlanV2 {
  const plan = discoveryPlanV2Schema.parse(input.record.compiled_snapshot_json);
  const hashablePlan: Record<string, unknown> = { ...plan };
  delete hashablePlan.contentHash;
  if (
    input.record.workspace_id !== input.workspaceId ||
    input.record.campaign_run_id !== input.campaignRunId ||
    input.record.campaign_id !== plan.campaignId ||
    input.record.campaign_strategy_version_id !== plan.campaignStrategyVersionId ||
    input.record.memory_snapshot_id !== plan.memorySnapshotId ||
    input.record.content_hash !== plan.contentHash ||
    plan.workspaceId !== input.workspaceId ||
    hashCanonical(hashablePlan) !== plan.contentHash
  ) {
    throw new Error("Persisted Semantic Discovery Plan identity mismatch.");
  }
  return plan;
}

export async function compileAndPersistDiscoveryPlan(input: {
  id: string;
  workspaceId: string;
  campaignRunId: string;
  strategy: CampaignStrategyV2;
  routes: SegmentProviderRouteV2[];
  providerCapabilities: DiscoveryProviderCapabilities[];
  versionNumber: number;
  maximumProviderCalls: number;
  maximumEstimatedCostMinor?: number;
  deadlineAt?: string;
  compiledAt: string;
}) {
  const compiledPlan = compileDiscoveryPlanV2(input);
  const record = await createCampaignDiscoveryPlan({
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
    plan: compiledPlan as unknown as Json,
    contentHash: compiledPlan.contentHash,
  });
  const plan = parsePersistedFrozenDiscoveryPlan({
    record,
    workspaceId: input.workspaceId,
    campaignRunId: input.campaignRunId,
  });
  return { plan, record };
}
