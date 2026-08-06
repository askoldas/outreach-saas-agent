import { z } from "zod";
import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database.types";
import {
  ENTITY_RESOLUTION_RUNTIME_RULES_VERSION,
  prepareResolutionCandidates,
  type CampaignResolutionInput,
} from "./candidate-preparation";
import { applyMemoryEntityResolutionEffects } from "@/lib/memory-v2";
import { prepareSemanticDiscoveryContext } from "@/server/discovery-v2/semantic-context";

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

const resolutionInputSchema = z
  .object({
    canonicalDomainHint: z.string().nullable(),
    country: z.string().nullable(),
    matchedArchetypeKey: z.string().min(1),
    matchedSegmentKey: z.string().min(1),
    name: z.string().min(1),
    normalizedCandidateId: z.string().min(1),
    normalizedName: z.string().nullable(),
    organizationTypeHint: z.string().nullable(),
    preliminaryQuality: z.unknown(),
    providerSourceRecordId: z.string().min(1),
    sourcePageType: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    websiteUrl: z.string().nullable(),
  })
  .strict();

const resolutionSummarySchema = z
  .object({
    batchId: z.string().min(1),
    campaignCandidateCount: z.number().int().nonnegative(),
    campaignCandidateIds: z.array(z.string().min(1)),
    campaignRunId: z.string().min(1),
    candidateCount: z.number().int().nonnegative(),
    canonicalOrganizations: z.number().int().nonnegative(),
    duplicatesOrMergedEntities: z.number().int().nonnegative(),
    groupCount: z.number().int().nonnegative(),
    groupIds: z.array(z.string().min(1)),
    inputHash: z.string().length(64),
    invalidEntities: z.number().int().nonnegative(),
    linkedExisting: z.number().int().nonnegative(),
    needsReview: z.number().int().nonnegative(),
    organizationsCreated: z.number().int().nonnegative(),
    resolutionDecisionIds: z.array(z.string().min(1)),
    rulesVersion: z.string().min(1),
    schemaVersion: z.literal(2),
    sourceLinkCount: z.number().int().nonnegative(),
  })
  .strict();

export type CampaignEntityResolutionSummary = z.infer<typeof resolutionSummarySchema>;

export async function resolveCampaignEntities(input: {
  campaignRunId: string;
  workspaceId: string;
}): Promise<CampaignEntityResolutionSummary> {
  const [loadedCandidates, semanticContext] = await Promise.all([
    rpc("load_campaign_entity_resolution_inputs_v2", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
    }),
    prepareSemanticDiscoveryContext(input),
  ]);
  const rawCandidates = z
    .array(resolutionInputSchema)
    .parse(loadedCandidates) as CampaignResolutionInput[];
  const memoryAdjustedCandidates = applyMemoryEntityResolutionEffects(
    rawCandidates,
    semanticContext.memoryEntityResolutionEffects,
  );
  const candidates = prepareResolutionCandidates(memoryAdjustedCandidates);
  const inputHash = hashCanonical({
    campaignRunId: input.campaignRunId,
    candidates,
    memorySnapshotId: semanticContext.memorySnapshot.id,
    memoryCompilationTrace: semanticContext.memoryCompilationTrace,
    rulesVersion: ENTITY_RESOLUTION_RUNTIME_RULES_VERSION,
    workspaceId: input.workspaceId,
  });
  return resolutionSummarySchema.parse(
    await rpc("resolve_campaign_entities_v2", {
      target_workspace_id: input.workspaceId,
      target_campaign_run_id: input.campaignRunId,
      target_rules_version: ENTITY_RESOLUTION_RUNTIME_RULES_VERSION,
      target_input_hash: inputHash,
      target_candidates: candidates as unknown as Json,
    }),
  );
}

async function rpc(name: string, args: Record<string, unknown>) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const { data, error } = await database.rpc(name, args);
  if (error) throw new Error(`Entity Resolution V2 persistence failed: ${error.message}`);
  return data;
}
