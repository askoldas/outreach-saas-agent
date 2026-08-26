import { z } from "zod";
import { extractOrganizationsFromDiscoverySource } from "@/lib/discovery-v2/providers/discovery-source-extraction";
import { createServiceRoleClient } from "@/lib/supabase/service";

const contextSchema = z
  .object({
    workspaceId: z.string().min(1),
    campaignId: z.string().min(1),
    providerExecutionId: z.string().min(1),
    providerSourceRecordId: z.string().min(1),
    normalizationVersion: z.string().min(1),
    segmentKey: z.string().min(1),
    archetypeKey: z.string().min(1),
    sourceUrl: z.url(),
    content: z.string(),
    sourceFamily: z.string().min(1),
    sourceType: z.string().min(1),
    queryFingerprint: z.string().min(1),
    nextOffset: z.number().int().nonnegative().nullable(),
    status: z.enum(["partial", "completed", "failed"]),
  })
  .strict();

type RpcResult = { data: unknown; error: { message: string } | null };

export async function continueDiscoverySourceExpansion(input: {
  workspaceId: string;
  sourceExpansionId: string;
  chunkSize?: number;
}) {
  const supabase = createServiceRoleClient() as unknown as {
    rpc(name: string, args: Record<string, unknown>): PromiseLike<RpcResult>;
  };
  const loaded = await supabase.rpc("load_discovery_source_expansion_v2", {
    target_workspace_id: input.workspaceId,
    target_source_expansion_id: input.sourceExpansionId,
  });
  if (loaded.error) {
    throw new Error(`Could not load discovery source expansion: ${loaded.error.message}`);
  }
  const context = contextSchema.parse(loaded.data);
  if (context.status === "completed" || context.nextOffset === null) {
    return { status: "completed" as const, expanded: 0, nextOffset: null };
  }
  const page = extractOrganizationsFromDiscoverySource({
    sourceUrl: context.sourceUrl,
    content: context.content,
    offset: context.nextOffset,
    maximumOrganizations: input.chunkSize ?? 25,
  });
  const persisted = await supabase.rpc("persist_discovery_source_expansion_v2", {
    target_workspace_id: context.workspaceId,
    target_campaign_id: context.campaignId,
    target_provider_execution_id: context.providerExecutionId,
    target_provider_source_record_id: context.providerSourceRecordId,
    target_normalization_version: context.normalizationVersion,
    target_segment_key: context.segmentKey,
    target_archetype_key: context.archetypeKey,
    target_page: page,
    target_source_family: context.sourceFamily,
    target_source_type: context.sourceType,
    target_query_fingerprint: context.queryFingerprint,
    target_created_at: new Date().toISOString(),
  });
  if (persisted.error) {
    throw new Error(
      `Could not continue discovery source expansion: ${persisted.error.message}`,
    );
  }
  return {
    status: page.exhausted ? ("completed" as const) : ("partial" as const),
    expanded: page.organizations.length,
    nextOffset: page.nextOffset,
  };
}
