import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type {
  AiGuidedResponse,
  GuidedScope,
  ProposedChange,
} from "@/lib/guided/contracts";

export type GuidedDraft = {
  id: string;
  scope: GuidedScope;
  entityId: string;
  baseVersion: number;
  currentStep: string;
  completedSteps: string[];
  draftData: Record<string, unknown>;
  status: "draft" | "ready" | "applied" | "discarded";
};

type GuidedDraftRow = {
  created_by: string | null;
  id: string;
  scope: GuidedScope;
  entity_id: string | null;
  base_version: number;
  proposal: Record<string, unknown>;
  status: GuidedDraft["status"];
  updated_at: string;
};

export async function getGuidedDraft(
  workspaceId: string,
  scope: GuidedScope,
  entityId: string,
): Promise<GuidedDraft | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const entityUuid = await resolveEntityUuid(supabase, workspaceId, scope, entityId);
  let query = supabase
    .from("ai_guided_drafts")
    .select("id,scope,entity_id,base_version,proposal,status,created_by,updated_at")
    .eq("workspace_id", workspaceId)
    .eq("scope", databaseScope(scope));
  query = entityUuid ? query.eq("entity_id", entityUuid) : query.is("entity_id", null);
  const { data, error } = await query
    .in("status", ["draft", "ready"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingGuidedTable(error)) return null;
    throw new Error(`Could not load guided draft: ${error.message}`);
  }
  if (
    data &&
    scope === "campaign" &&
    entityId === "new" &&
    data.status === "ready" &&
    data.created_by
  ) {
    const { data: newerCampaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("created_by", data.created_by)
      .gte("created_at", data.updated_at)
      .limit(1)
      .maybeSingle();
    if (campaignError)
      throw new Error(
        `Could not validate guided draft freshness: ${campaignError.message}`,
      );
    if (newerCampaign) {
      const { error: consumeError } = await supabase
        .from("ai_guided_drafts")
        .update({ status: "applied" })
        .eq("workspace_id", workspaceId)
        .eq("id", data.id)
        .eq("status", "ready");
      if (consumeError)
        throw new Error(
          `Could not retire consumed guided draft: ${consumeError.message}`,
        );
      return null;
    }
  }
  return data ? mapDraft(data as GuidedDraftRow) : null;
}

export async function completeGuidedDraft(
  workspaceId: string,
  scope: GuidedScope,
  entityId: string,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const entityUuid = await resolveEntityUuid(supabase, workspaceId, scope, entityId);
  let query = supabase
    .from("ai_guided_drafts")
    .update({ status: "applied" })
    .eq("workspace_id", workspaceId)
    .eq("scope", databaseScope(scope))
    .in("status", ["draft", "ready"]);
  query = entityUuid ? query.eq("entity_id", entityUuid) : query.is("entity_id", null);
  const { error } = await query;
  if (error && !isMissingGuidedTable(error))
    throw new Error(`Could not complete guided draft: ${error.message}`);
}

export async function saveGuidedDraft(
  workspaceId: string,
  userId: string,
  input: Omit<GuidedDraft, "id">,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const entityUuid = await resolveEntityUuid(
    supabase,
    workspaceId,
    input.scope,
    input.entityId,
  );
  const scope = databaseScope(input.scope);
  let existingQuery = supabase
    .from("ai_guided_drafts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("scope", scope);
  existingQuery = entityUuid
    ? existingQuery.eq("entity_id", entityUuid)
    : existingQuery.is("entity_id", null);
  const existing = await existingQuery
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error && !isMissingGuidedTable(existing.error))
    throw new Error(`Could not resolve guided draft: ${existing.error.message}`);
  const values = {
    workspace_id: workspaceId,
    created_by: userId,
    scope,
    entity_id: entityUuid,
    base_version: Math.max(1, input.baseVersion),
    proposal: {
      currentStep: input.currentStep,
      completedSteps: input.completedSteps,
      draftData: input.draftData,
      externalEntityId: input.entityId,
    },
    status: input.status,
  };
  const mutation = existing.data
    ? supabase
        .from("ai_guided_drafts")
        .update(values)
        .eq("workspace_id", workspaceId)
        .eq("id", existing.data.id)
    : supabase.from("ai_guided_drafts").insert(values);
  const { data, error } = await mutation
    .select("id,scope,entity_id,base_version,proposal,status,created_by,updated_at")
    .single();
  if (error) {
    if (isMissingGuidedTable(error))
      return { id: "session-only", ...input } satisfies GuidedDraft;
    throw new Error(`Could not save guided draft: ${error.message}`);
  }
  return mapDraft(data as GuidedDraftRow);
}

export async function recordAppliedChanges(
  workspaceId: string,
  userId: string,
  input: {
    entityId: string;
    baseVersion?: number;
    source: "guided_selection" | "natural_language" | "ai_recommendation" | "direct_edit";
    changes: ProposedChange[];
  },
) {
  if (!input.changes.length) return;
  const { supabase } = await createAuthenticatedDatabaseClient();
  const scope: GuidedScope =
    input.changes[0]?.entityType === "company_profile" ? "company" : "campaign";
  const entityUuid = await resolveEntityUuid(
    supabase,
    workspaceId,
    scope,
    input.entityId,
  );
  const sourceVersion = Math.max(1, input.baseVersion ?? 1);
  const { error } = await supabase.from("ai_applied_changes").insert({
    workspace_id: workspaceId,
    scope: databaseScope(scope),
    entity_id: entityUuid,
    source_version: sourceVersion,
    target_version: sourceVersion + 1,
    changes: input.changes,
    undo_metadata: { source: input.source },
    applied_by: userId,
  });
  if (error) throw new Error(`Could not record applied changes: ${error.message}`);
}

export async function recordGuidedExchange(
  workspaceId: string,
  userId: string,
  input: {
    scope: "company" | "campaign";
    entityId: string;
    request: string;
    response: AiGuidedResponse;
  },
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const entityUuid = await resolveEntityUuid(
    supabase,
    workspaceId,
    input.scope,
    input.entityId,
  );
  const scope = databaseScope(input.scope);
  let conversationQuery = supabase
    .from("ai_conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("scope", scope)
    .eq("created_by", userId);
  conversationQuery = entityUuid
    ? conversationQuery.eq("entity_id", entityUuid)
    : conversationQuery.is("entity_id", null);
  const existing = await conversationQuery.maybeSingle();
  if (existing.error && isMissingGuidedTable(existing.error)) return;
  if (existing.error)
    throw new Error(`Could not load guided conversation: ${existing.error.message}`);

  let conversationId = existing.data?.id as string | undefined;
  if (!conversationId) {
    const created = await supabase
      .from("ai_conversations")
      .insert({
        workspace_id: workspaceId,
        scope,
        entity_id: entityUuid,
        created_by: userId,
      })
      .select("id")
      .single();
    if (created.error && isMissingGuidedTable(created.error)) return;
    if (created.error)
      throw new Error(`Could not create guided conversation: ${created.error.message}`);
    conversationId = created.data.id as string;
  }

  const { error } = await supabase.from("ai_messages").insert([
    {
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: "user",
      content: input.request,
    },
    {
      workspace_id: workspaceId,
      conversation_id: conversationId,
      role: "assistant",
      content: input.response.message,
      metadata: { guidedResponse: input.response },
    },
  ]);
  if (error && !isMissingGuidedTable(error))
    throw new Error(`Could not save guided exchange: ${error.message}`);
}

function isMissingGuidedTable(error: { code?: string; message?: string }) {
  return (
    error.code === "PGRST205" ||
    Boolean(
      error.message?.includes("schema cache") &&
      /ai_(guided_drafts|conversations|messages|applied_changes)/.test(error.message),
    )
  );
}

function mapDraft(row: GuidedDraftRow): GuidedDraft {
  return {
    id: row.id,
    scope: row.scope,
    entityId: stringValue(row.proposal.externalEntityId) || row.entity_id || "new",
    baseVersion: row.base_version,
    currentStep: stringValue(row.proposal.currentStep),
    completedSteps: stringArray(row.proposal.completedSteps),
    draftData: recordValue(row.proposal.draftData),
    status: row.status,
  };
}

type DatabaseClient = Awaited<
  ReturnType<typeof createAuthenticatedDatabaseClient>
>["supabase"];

function databaseScope(scope: GuidedScope | "company" | "campaign") {
  return scope === "company" ? "company_profile" : "campaign";
}

async function resolveEntityUuid(
  supabase: DatabaseClient,
  workspaceId: string,
  scope: GuidedScope | "company" | "campaign",
  entityId: string,
) {
  if (entityId === "new") return null;
  const table = scope === "company" ? "company_profiles" : "campaigns";
  let query = supabase.from(table).select("id").eq("workspace_id", workspaceId);
  if (scope === "campaign") query = query.eq("external_id", entityId);
  else query = query.eq("id", entityId);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Could not resolve guided entity: ${error.message}`);
  if (!data) throw new Error("The guided entity no longer exists.");
  return data.id;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordValue(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
