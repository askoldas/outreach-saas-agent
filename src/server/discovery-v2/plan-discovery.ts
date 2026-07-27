import {
  compileDiscoveryPlanV2,
  type DiscoveryProviderCapabilities,
  type SegmentProviderRouteV2,
} from "@/lib/discovery-v2";
import type { CampaignStrategyV2 } from "@/lib/intelligence/campaign-strategy-v2";
import type { Json } from "@/types/database.types";
import { createDiscoveryPlan } from "./coverage-repository";

export async function compileAndPersistDiscoveryPlan(input: {
  id: string;
  workspaceId: string;
  strategy: CampaignStrategyV2;
  routes: SegmentProviderRouteV2[];
  providerCapabilities: DiscoveryProviderCapabilities[];
  versionNumber: number;
  maximumProviderCalls: number;
  maximumEstimatedCostMinor?: number;
  deadlineAt?: string;
  compiledAt: string;
}) {
  const plan = compileDiscoveryPlanV2(input);
  const record = await createDiscoveryPlan({
    workspaceId: input.workspaceId,
    campaignId: plan.campaignId,
    strategyVersionId: plan.campaignStrategyVersionId,
    memorySnapshotId: plan.memorySnapshotId,
    plan: plan as unknown as Json,
    contentHash: plan.contentHash,
  });
  return { plan, record };
}
