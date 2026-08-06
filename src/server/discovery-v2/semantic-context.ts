import {
  intelligenceMemorySchema,
  memoryEffectSchema,
  type IntelligenceMemory,
} from "@/lib/intelligence/contracts/memory";
import {
  campaignStrategyV2Schema,
  hashCanonical,
  type CampaignStrategyV2,
} from "@/lib/intelligence/campaign-strategy-v2";
import {
  excludedMemorySchema,
  compileMemoryEffects,
  memoryRetrievalContextSchema,
  resolveApplicableMemories,
  type MemoryRetrievalContext,
} from "@/lib/memory-v2";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { Database, Json } from "@/types/database.types";
import { z } from "zod";
import { loadInitialDiscoveryContext } from "./stage-context";

const memoryConflictSchema = z
  .object({
    winnerId: z.string().min(1),
    overriddenId: z.string().min(1),
    reason: z.string().min(1),
  })
  .strict();

const legacyCampaignMemorySnapshotPayloadSchema = z
  .object({
    schemaVersion: z.literal(2),
    context: memoryRetrievalContextSchema,
    appliedMemoryIds: z.array(z.string().min(1)),
    overriddenMemoryIds: z.array(z.string().min(1)),
    excluded: z.array(excludedMemorySchema),
    conflicts: z.array(memoryConflictSchema),
  })
  .strict();

const campaignMemorySnapshotPayloadSchema = z.discriminatedUnion("schemaVersion", [
  legacyCampaignMemorySnapshotPayloadSchema,
  z
    .object({
      schemaVersion: z.literal(3),
      context: memoryRetrievalContextSchema,
      applied: z.array(intelligenceMemorySchema),
      overridden: z.array(intelligenceMemorySchema),
      appliedMemoryIds: z.array(z.string().min(1)),
      overriddenMemoryIds: z.array(z.string().min(1)),
      excluded: z.array(excludedMemorySchema),
      conflicts: z.array(memoryConflictSchema),
      effectCompilerVersion: z.string().min(1),
      compilationTrace: z.array(
        z.object({
          memoryId: z.string().min(1),
          effectType: z.string().min(1),
          changedLayers: z.array(z.string().min(1)),
        }),
      ),
    })
    .strict(),
]);

const frozenMemorySnapshotRowSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  campaign_id: z.string().min(1),
  campaign_strategy_version_id: z.string().min(1),
  campaign_run_id: z.string().min(1),
  snapshot_json: campaignMemorySnapshotPayloadSchema,
  content_hash: z.string().length(64),
});

type InitialDiscoveryContext = Awaited<ReturnType<typeof loadInitialDiscoveryContext>>;
type PersistedMemoryRow = Database["public"]["Tables"]["intelligence_memories"]["Row"];
type MemoryApplicationInsert =
  Database["public"]["Tables"]["memory_application_events"]["Insert"];
type CampaignMemorySnapshotPayload = z.infer<typeof campaignMemorySnapshotPayloadSchema>;

export async function prepareSemanticDiscoveryContext(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const context = await loadInitialDiscoveryContext(input);
  const existingSnapshot = await loadFrozenCampaignRunMemorySnapshot({
    campaignRunId: context.campaignRunId,
    campaignId: context.campaignInternalId,
    strategyVersionId: context.strategyVersionId,
    workspaceId: context.workspaceId,
  });
  if (existingSnapshot) {
    return finalizeSemanticContext(context, existingSnapshot);
  }
  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("intelligence_memories")
    .select("*")
    .eq("workspace_id", input.workspaceId)
    .in("status", [
      "proposed",
      "provisional",
      "confirmed",
      "rejected",
      "superseded",
      "expired",
      "archived",
    ])
    .lte("created_at", context.campaignRunCreatedAt)
    .lte("updated_at", context.campaignRunCreatedAt)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .limit(500);
  if (error) throw new Error(`Could not load V2 campaign Memory: ${error.message}`);

  const retrievalContext = buildCampaignMemoryRetrievalContext(context);
  const evidenceIdsByMemoryId = await loadMemoryEvidenceIds(
    input.workspaceId,
    (rows ?? []).map(({ id }) => id),
  );
  const resolved = resolveApplicableMemories(
    (rows ?? []).map((row) =>
      mapPersistedMemory(row, evidenceIdsByMemoryId.get(row.id) ?? []),
    ),
    retrievalContext,
  );
  const compiled = compileMemoryEffects({
    strategy: context.strategy,
    memories: resolved.applied,
  });
  const snapshot = campaignMemorySnapshotPayloadSchema.parse({
    schemaVersion: 3,
    context: retrievalContext,
    applied: resolved.applied,
    overridden: resolved.overridden,
    appliedMemoryIds: resolved.applied.map(({ id }) => id),
    overriddenMemoryIds: resolved.overridden.map(({ id }) => id),
    excluded: resolved.excluded,
    conflicts: [...resolved.conflicts].sort(
      (left, right) =>
        compareText(left.winnerId, right.winnerId) ||
        compareText(left.overriddenId, right.overriddenId) ||
        compareText(left.reason, right.reason),
    ),
    effectCompilerVersion: compiled.compilerVersion,
    compilationTrace: compiled.trace,
  });
  const contentHash = hashCanonical(snapshot);
  const memorySnapshot = await freezeCampaignRunMemorySnapshot({
    campaignRunId: context.campaignRunId,
    campaignId: context.campaignInternalId,
    contentHash,
    snapshot,
    strategyVersionId: context.strategyVersionId,
    workspaceId: context.workspaceId,
  });
  return finalizeSemanticContext(context, memorySnapshot);
}

async function finalizeSemanticContext(
  context: InitialDiscoveryContext,
  memorySnapshot: {
    id: string;
    contentHash: string;
    snapshot: CampaignMemorySnapshotPayload;
  },
) {
  await recordMemoryApplications({
    campaignId: context.campaignInternalId,
    memorySnapshotId: memorySnapshot.id,
    snapshot: memorySnapshot.snapshot,
    workspaceId: context.workspaceId,
  });

  const canonicalStrategy = canonicalizeStrategyForDiscovery({
    campaignId: context.campaignInternalId,
    memorySnapshotId: memorySnapshot.id,
    strategy: context.strategy,
    strategyVersionId: context.strategyVersionId,
    strategyVersionNumber: context.strategyVersionNumber,
  });
  const compiled = compileMemoryEffects({
    strategy: canonicalStrategy,
    memories:
      memorySnapshot.snapshot.schemaVersion === 3 ? memorySnapshot.snapshot.applied : [],
  });
  return {
    ...context,
    memorySnapshot,
    strategy: compiled.strategy,
    memoryEntityResolutionEffects: compiled.entityResolutionEffects,
    memoryCompilationTrace: compiled.trace,
  };
}

export function buildCampaignMemoryRetrievalContext(
  context: InitialDiscoveryContext,
): MemoryRetrievalContext {
  return memoryRetrievalContextSchema.parse({
    workspaceId: context.workspaceId,
    ...(context.confirmedByUserId ? { userId: context.confirmedByUserId } : {}),
    offeringIds: sortedUnique(
      context.strategy.offeringReferences.map(({ offeringId }) => offeringId),
    ),
    campaignId: context.campaignInternalId,
    runId: context.campaignRunId,
    objectiveCode: context.strategy.objective.code,
    geographyCodes: sortedUnique(context.strategy.geography.countryCodes),
    archetypeIds: sortedUnique(
      context.strategy.discoverySegments.map(({ archetypeId }) => archetypeId),
    ),
    relationshipTypes: sortedUnique([
      ...context.strategy.objective.targetRelationshipTypes,
      ...context.strategy.discoverySegments.map(
        ({ relationshipType }) => relationshipType,
      ),
    ]),
    qualificationFactorKeys: sortedUnique(
      context.strategy.qualificationPolicy.factorDefinitions.map(
        ({ factorKey }) => factorKey,
      ),
    ),
    now: context.campaignRunCreatedAt,
  });
}

export function canonicalizeStrategyForDiscovery(input: {
  campaignId: string;
  memorySnapshotId: string;
  strategy: CampaignStrategyV2;
  strategyVersionId: string;
  strategyVersionNumber: number;
}): CampaignStrategyV2 {
  return campaignStrategyV2Schema.parse({
    ...input.strategy,
    id: input.strategyVersionId,
    campaignId: input.campaignId,
    versionNumber: input.strategyVersionNumber,
    status: "confirmed",
    memorySnapshotId: input.memorySnapshotId,
    archetypes: input.strategy.archetypes.map((archetype) => ({
      ...archetype,
      strategyVersionId: input.strategyVersionId,
    })),
    discoverySegments: input.strategy.discoverySegments.map((segment) => ({
      ...segment,
      strategyVersionId: input.strategyVersionId,
    })),
  });
}

async function freezeCampaignRunMemorySnapshot(input: {
  campaignRunId: string;
  campaignId: string;
  contentHash: string;
  snapshot: CampaignMemorySnapshotPayload;
  strategyVersionId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("freeze_campaign_run_memory_snapshot_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
    target_strategy_version_id: input.strategyVersionId,
    target_snapshot: input.snapshot as unknown as Json,
    target_content_hash: input.contentHash,
  });
  if (error) throw new Error(`Could not freeze V2 Campaign Memory: ${error.message}`);
  const row = frozenMemorySnapshotRowSchema.parse(data);
  if (
    row.workspace_id !== input.workspaceId ||
    row.campaign_id !== input.campaignId ||
    row.campaign_strategy_version_id !== input.strategyVersionId ||
    row.campaign_run_id !== input.campaignRunId ||
    row.snapshot_json.context.runId !== input.campaignRunId
  ) {
    throw new Error("Frozen V2 Campaign Memory returned mismatched identities.");
  }
  if (hashCanonical(row.snapshot_json) !== row.content_hash) {
    throw new Error("Frozen V2 Campaign Memory returned a mismatched content hash.");
  }
  return {
    id: row.id,
    contentHash: row.content_hash,
    snapshot: row.snapshot_json,
  };
}

async function loadFrozenCampaignRunMemorySnapshot(input: {
  campaignRunId: string;
  campaignId: string;
  strategyVersionId: string;
  workspaceId: string;
}) {
  const supabase = createServiceRoleClient();
  const database = supabase as unknown as {
    rpc(
      name: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await database.rpc("load_campaign_run_memory_snapshot_v2", {
    target_workspace_id: input.workspaceId,
    target_campaign_run_id: input.campaignRunId,
  });
  if (error)
    throw new Error(`Could not load frozen V2 Campaign Memory: ${error.message}`);
  if (data === null) return null;
  const row = frozenMemorySnapshotRowSchema.parse(data);
  if (
    row.workspace_id !== input.workspaceId ||
    row.campaign_id !== input.campaignId ||
    row.campaign_strategy_version_id !== input.strategyVersionId ||
    row.campaign_run_id !== input.campaignRunId ||
    row.snapshot_json.context.runId !== input.campaignRunId ||
    hashCanonical(row.snapshot_json) !== row.content_hash
  ) {
    throw new Error("Frozen V2 Campaign Memory returned mismatched identities.");
  }
  return {
    id: row.id,
    contentHash: row.content_hash,
    snapshot: row.snapshot_json,
  };
}

async function recordMemoryApplications(input: {
  campaignId: string;
  memorySnapshotId: string;
  snapshot: CampaignMemorySnapshotPayload;
  workspaceId: string;
}) {
  const conflictByOverriddenMemoryId = new Map(
    input.snapshot.conflicts.map((conflict) => [conflict.overriddenId, conflict]),
  );
  const events: MemoryApplicationInsert[] = [
    ...input.snapshot.appliedMemoryIds.map((memoryId) => ({
      workspace_id: input.workspaceId,
      memory_id: memoryId,
      memory_snapshot_id: input.memorySnapshotId,
      applied_to_type: "campaign",
      applied_to_id: input.campaignId,
      application_reason: "Frozen for the V2 Campaign discovery run.",
      result: "applied",
      precedence_result_json: {},
    })),
    ...input.snapshot.overriddenMemoryIds.map((memoryId) => {
      const conflict = conflictByOverriddenMemoryId.get(memoryId);
      return {
        workspace_id: input.workspaceId,
        memory_id: memoryId,
        memory_snapshot_id: input.memorySnapshotId,
        applied_to_type: "campaign",
        applied_to_id: input.campaignId,
        application_reason: "Overridden by a higher-precedence applicable memory.",
        result: "overridden",
        precedence_result_json: conflict ? { conflict } : {},
      };
    }),
  ];
  if (!events.length) return;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("memory_application_events").upsert(events, {
    onConflict: "memory_snapshot_id,memory_id,applied_to_type,applied_to_id",
    ignoreDuplicates: true,
  });
  if (error) throw new Error(`Could not audit V2 Memory application: ${error.message}`);
}

function mapPersistedMemory(
  row: PersistedMemoryRow,
  evidenceIds: string[],
): IntelligenceMemory {
  const effect = memoryEffectSchema.safeParse(row.structured_value_json);
  return intelligenceMemorySchema.parse({
    id: row.id,
    workspaceId: row.workspace_id,
    ...(row.user_id ? { userId: row.user_id } : {}),
    scope: row.scope_type,
    scopeId: row.scope_id,
    kind: row.memory_type,
    statement: row.statement,
    ...(effect.success ? { effect: effect.data } : {}),
    applicability: row.applicability_json,
    applicabilityStatus: row.applicability_known ? "known" : "unknown",
    strength: row.strength,
    status: row.status,
    source: row.source,
    confidence: row.confidence,
    ...(row.origin_campaign_id ? { originCampaignId: row.origin_campaign_id } : {}),
    ...(row.origin_run_id ? { originRunId: row.origin_run_id } : {}),
    ...(row.origin_candidate_id ? { originCandidateId: row.origin_candidate_id } : {}),
    originType: row.origin_type,
    ...(row.origin_id ? { originId: row.origin_id } : {}),
    ...(row.supersedes_memory_id ? { supersedesMemoryId: row.supersedes_memory_id } : {}),
    ...(row.created_by_user_id ? { createdByUserId: row.created_by_user_id } : {}),
    recordVersion: canonicalTimestamp(row.updated_at),
    evidenceIds,
    createdAt: canonicalTimestamp(row.created_at),
    updatedAt: canonicalTimestamp(row.updated_at),
    ...(row.last_applied_at
      ? { lastAppliedAt: canonicalTimestamp(row.last_applied_at) }
      : {}),
    ...(row.expires_at ? { expiresAt: canonicalTimestamp(row.expires_at) } : {}),
  });
}

async function loadMemoryEvidenceIds(workspaceId: string, memoryIds: string[]) {
  const result = new Map<string, string[]>();
  if (!memoryIds.length) return result;
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("memory_evidence_links")
    .select("memory_id,evidence_id")
    .eq("workspace_id", workspaceId)
    .in("memory_id", memoryIds)
    .not("evidence_id", "is", null);
  if (error) throw new Error(`Could not load V2 Memory evidence: ${error.message}`);
  for (const row of data ?? []) {
    if (!row.evidence_id) continue;
    result.set(row.memory_id, [...(result.get(row.memory_id) ?? []), row.evidence_id]);
  }
  for (const [memoryId, values] of result) result.set(memoryId, sortedUnique(values));
  return result;
}

function sortedUnique(values: string[]) {
  return [...new Set(values)].sort(compareText);
}

function canonicalTimestamp(value: string) {
  return new Date(value).toISOString();
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
