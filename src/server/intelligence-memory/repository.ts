import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { IntelligenceMemory } from "@/lib/intelligence/contracts/memory";
import type { Json } from "@/types/database.types";

type DatabaseError = { message: string };
type QueryResult = { data: unknown; error: DatabaseError | null };
type MemoryQuery = {
  select(columns: string): MemoryQuery;
  eq(column: string, value: unknown): MemoryQuery;
  in(column: string, values: unknown[]): MemoryQuery;
  order(column: string, options?: { ascending: boolean }): MemoryQuery;
  limit(count: number): PromiseLike<QueryResult>;
  insert(values: unknown): PromiseLike<QueryResult>;
};
type MemoryDatabase = {
  from(table: string): MemoryQuery;
  rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
};

export async function listMemoryCandidates(workspaceId: string) {
  const database = await memoryDatabase();
  const { data, error } = await database
    .from("intelligence_memories")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("status", [
      "proposed",
      "provisional",
      "confirmed",
      "rejected",
      "superseded",
      "expired",
      "archived",
    ])
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(`Could not retrieve Intelligence Memory: ${error.message}`);
  return arrayValue(data).map(mapMemory);
}

export async function createCampaignMemorySnapshot(input: {
  workspaceId: string;
  campaignId: string;
  strategyVersionId: string | null;
  snapshot: Json;
  contentHash: string;
}) {
  const database = await memoryDatabase();
  const { data, error } = await database.rpc("create_campaign_memory_snapshot", {
    target_workspace_id: input.workspaceId,
    target_campaign_id: input.campaignId,
    target_strategy_version_id: input.strategyVersionId,
    target_snapshot: input.snapshot,
    target_content_hash: input.contentHash,
  });
  if (error) throw new Error(`Could not freeze Campaign Memory: ${error.message}`);
  return objectValue(data);
}

export async function recordMemoryApplications(
  events: Array<{
    workspace_id: string;
    memory_id: string;
    memory_snapshot_id: string;
    applied_to_type: string;
    applied_to_id: string;
    application_reason: string;
    result: string;
    precedence_result_json: Json;
  }>,
) {
  if (!events.length) return;
  const database = await memoryDatabase();
  const { error } = await database.from("memory_application_events").insert(events);
  if (error) throw new Error(`Could not audit Memory application: ${error.message}`);
}

export async function recordCampaignCorrection(input: {
  workspaceId: string;
  campaignId: string;
  correctionType: string;
  statement: string;
  previousValue: Json | null;
  correctedValue: Json;
  immediateAction: string;
  applicability: Json;
  proposedOfferingId: string | null;
}) {
  const database = await memoryDatabase();
  const { data, error } = await database.rpc("record_campaign_memory_correction", {
    target_workspace_id: input.workspaceId,
    target_campaign_id: input.campaignId,
    target_correction_type: input.correctionType,
    target_statement: input.statement,
    target_previous_value: input.previousValue,
    target_corrected_value: input.correctedValue,
    target_immediate_action: input.immediateAction,
    target_applicability: input.applicability,
    target_proposed_offering_id: input.proposedOfferingId,
  });
  if (error) throw new Error(`Could not record Campaign correction: ${error.message}`);
  return objectValue(data);
}

export async function resolveMemoryPromotion(input: {
  workspaceId: string;
  proposalId: string;
  decision: "accepted" | "rejected" | "deferred";
}) {
  const database = await memoryDatabase();
  const { data, error } = await database.rpc("resolve_memory_promotion_proposal", {
    target_workspace_id: input.workspaceId,
    target_proposal_id: input.proposalId,
    target_decision: input.decision,
  });
  if (error) throw new Error(`Could not resolve Memory promotion: ${error.message}`);
  return objectValue(data);
}

async function memoryDatabase() {
  const { supabase } = await createAuthenticatedDatabaseClient();
  return supabase as unknown as MemoryDatabase;
}

function mapMemory(value: unknown): IntelligenceMemory {
  const row = objectValue(value);
  return {
    id: stringValue(row.id),
    workspaceId: stringValue(row.workspace_id),
    ...(typeof row.user_id === "string" ? { userId: row.user_id } : {}),
    scope: stringValue(row.scope_type) as IntelligenceMemory["scope"],
    scopeId: stringValue(row.scope_id),
    kind: stringValue(row.memory_type) as IntelligenceMemory["kind"],
    statement: stringValue(row.statement),
    applicability: objectValue(
      row.applicability_json,
    ) as IntelligenceMemory["applicability"],
    applicabilityStatus: row.applicability_known === false ? "unknown" : "known",
    strength: stringValue(row.strength) as IntelligenceMemory["strength"],
    status: stringValue(row.status) as IntelligenceMemory["status"],
    source: stringValue(row.source) as IntelligenceMemory["source"],
    confidence: numberValue(row.confidence),
    ...(typeof row.origin_campaign_id === "string"
      ? { originCampaignId: row.origin_campaign_id }
      : {}),
    ...(typeof row.origin_run_id === "string" ? { originRunId: row.origin_run_id } : {}),
    ...(typeof row.origin_candidate_id === "string"
      ? { originCandidateId: row.origin_candidate_id }
      : {}),
    evidenceIds: [],
    createdAt: stringValue(row.created_at),
    updatedAt: stringValue(row.updated_at),
    ...(typeof row.last_applied_at === "string"
      ? { lastAppliedAt: row.last_applied_at }
      : {}),
    ...(typeof row.expires_at === "string" ? { expiresAt: row.expires_at } : {}),
  };
}

function arrayValue(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Intelligence Memory persistence returned an invalid record.");
  }
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  if (typeof value !== "string") throw new Error("Memory field is not a string.");
  return value;
}

function numberValue(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error("Memory confidence is invalid.");
  return number;
}
