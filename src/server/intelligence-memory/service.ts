import { hashCanonical } from "@/lib/intelligence/campaign-strategy-v2";
import { resolveApplicableMemories, type MemoryRetrievalContext } from "@/lib/memory-v2";
import type { Json } from "@/types/database.types";
import {
  createCampaignMemorySnapshot,
  listMemoryCandidates,
  recordMemoryApplications,
} from "./repository";

export async function compileAndFreezeCampaignMemory(input: {
  workspaceId: string;
  campaignId: string;
  campaignInternalId: string;
  strategyVersionId: string | null;
  context: MemoryRetrievalContext;
}) {
  const candidates = await listMemoryCandidates(input.workspaceId);
  const resolved = resolveApplicableMemories(candidates, input.context);
  const snapshot = {
    schemaVersion: 2,
    context: input.context,
    appliedMemoryIds: resolved.applied.map((memory) => memory.id),
    overriddenMemoryIds: resolved.overridden.map((memory) => memory.id),
    excluded: resolved.excluded,
    conflicts: resolved.conflicts,
  };
  const contentHash = hashCanonical(snapshot);
  const saved = await createCampaignMemorySnapshot({
    workspaceId: input.workspaceId,
    campaignId: input.campaignInternalId,
    strategyVersionId: input.strategyVersionId,
    snapshot: snapshot as unknown as Json,
    contentHash,
  });
  const snapshotId = String(saved.id);
  await recordMemoryApplications([
    ...resolved.applied.map((memory) => ({
      workspace_id: input.workspaceId,
      memory_id: memory.id,
      memory_snapshot_id: snapshotId,
      applied_to_type: "campaign",
      applied_to_id: input.campaignInternalId,
      application_reason: `Compiled for Campaign ${input.campaignId}.`,
      result: "applied",
      precedence_result_json: {} as Json,
    })),
    ...resolved.overridden.map((memory) => ({
      workspace_id: input.workspaceId,
      memory_id: memory.id,
      memory_snapshot_id: snapshotId,
      applied_to_type: "campaign",
      applied_to_id: input.campaignInternalId,
      application_reason: "Overridden by a higher-precedence applicable memory.",
      result: "overridden",
      precedence_result_json: {
        conflict: resolved.conflicts.find(
          (conflict) => conflict.overriddenId === memory.id,
        ),
      } as Json,
    })),
  ]);
  return { snapshotId, contentHash, resolved };
}
