import {
  compileDiscoveryPlanFromMarketResearchPlan,
  compileDiscoveryPlanV2,
  discoveryPlanV2Schema,
  type DiscoveryPlanV2,
  type DiscoveryProviderCapabilities,
  type SegmentProviderRouteV2,
} from "@/lib/discovery-v2";
import { marketResearchPlanSchema } from "@/lib/intelligence/core";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { loadProviderCapabilitySnapshots } from "@/server/core-intelligence-v2/repository";
import { z } from "zod";
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

const researchPlanRowSchema = z
  .object({
    id: z.string().min(1),
    workspace_id: z.string().min(1),
    campaign_id: z.string().min(1),
    campaign_run_id: z.string().min(1).nullable(),
    plan_json: z.unknown(),
    created_at: z.iso.datetime({ offset: true }),
  })
  .strict();

export async function loadMarketResearchPlanForDiscovery(input: {
  workspaceId: string;
  campaignId: string;
  campaignRunId: string;
  runCreatedAt: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("market_research_plan_versions_v2")
    .select("id,workspace_id,campaign_id,campaign_run_id,plan_json,created_at")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_id", input.campaignId)
    .lte("created_at", input.runCreatedAt)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load Market Research Plan: ${error.message}`);
  if (!data) return null;
  const row = researchPlanRowSchema.parse(data);
  if (row.campaign_run_id && row.campaign_run_id !== input.campaignRunId) {
    return null;
  }
  const plan = marketResearchPlanSchema.parse(row.plan_json);
  if (
    plan.id !== row.id ||
    plan.workspaceId !== input.workspaceId ||
    plan.campaignId !== input.campaignId
  ) {
    throw new Error("Market Research Plan persistence identity mismatch.");
  }
  return plan;
}

export async function compileAndPersistDiscoveryPlanFromMarketResearch(input: {
  id: string;
  workspaceId: string;
  campaignRunId: string;
  strategy: CampaignStrategyV2;
  researchPlan: ReturnType<typeof marketResearchPlanSchema.parse>;
  enabledProviderIds: string[];
  versionNumber: number;
  maximumProviderCalls: number;
  maximumEstimatedCostMinor?: number;
  deadlineAt?: string;
  compiledAt: string;
}) {
  const providerCapabilities = await loadProviderCapabilitySnapshots({
    workspaceId: input.workspaceId,
    ids: input.researchPlan.providerCapabilitySnapshotIds,
  });
  const compiledPlan = compileDiscoveryPlanFromMarketResearchPlan({
    id: input.id,
    workspaceId: input.workspaceId,
    strategy: input.strategy,
    researchPlan: input.researchPlan,
    providerCapabilities,
    enabledProviderIds: input.enabledProviderIds,
    versionNumber: input.versionNumber,
    maximumProviderCalls: input.maximumProviderCalls,
    ...(input.maximumEstimatedCostMinor === undefined
      ? {}
      : { maximumEstimatedCostMinor: input.maximumEstimatedCostMinor }),
    ...(input.deadlineAt ? { deadlineAt: input.deadlineAt } : {}),
    compiledAt: input.compiledAt,
  });
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
