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
  id: string;
  scope: GuidedScope;
  entity_id: string;
  base_version: number;
  current_step: string;
  completed_steps: string[];
  draft_data: Record<string, unknown>;
  status: GuidedDraft["status"];
};

export async function getGuidedDraft(
  workspaceId: string,
  scope: GuidedScope,
  entityId: string,
): Promise<GuidedDraft | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("ai_guided_drafts")
    .select(
      "id,scope,entity_id,base_version,current_step,completed_steps,draft_data,status",
    )
    .eq("workspace_id", workspaceId)
    .eq("scope", scope)
    .eq("entity_id", entityId)
    .maybeSingle();
  if (error) {
    if (isMissingGuidedTable(error)) return null;
    throw new Error(`Could not load guided draft: ${error.message}`);
  }
  return data ? mapDraft(data as GuidedDraftRow) : null;
}

export async function saveGuidedDraft(
  workspaceId: string,
  userId: string,
  input: Omit<GuidedDraft, "id">,
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("ai_guided_drafts")
    .upsert(
      {
        workspace_id: workspaceId,
        created_by: userId,
        scope: input.scope,
        entity_id: input.entityId,
        base_version: input.baseVersion,
        current_step: input.currentStep,
        completed_steps: input.completedSteps,
        draft_data: input.draftData,
        status: input.status,
      },
      { onConflict: "workspace_id,scope,entity_id" },
    )
    .select(
      "id,scope,entity_id,base_version,current_step,completed_steps,draft_data,status",
    )
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
  const { error } = await supabase.from("ai_applied_changes").insert(
    input.changes.map((change) => ({
      workspace_id: workspaceId,
      proposal_id: change.id,
      entity_type: change.entityType,
      entity_id: change.entityId ?? input.entityId,
      operation: change.operation,
      field_path: change.fieldPath ?? null,
      previous_value: change.previousValue ?? null,
      applied_value: change.proposedValue,
      source: input.source,
      base_version: input.baseVersion ?? null,
      applied_by_user_id: userId,
    })),
  );
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
  const existing = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("scope", input.scope)
    .eq("entity_id", input.entityId)
    .eq("created_by", userId)
    .maybeSingle();
  if (existing.error && isMissingGuidedTable(existing.error)) return;
  if (existing.error)
    throw new Error(`Could not load guided conversation: ${existing.error.message}`);

  let conversationId = existing.data?.id as string | undefined;
  if (!conversationId) {
    const created = await supabase
      .from("ai_conversations")
      .insert({
        workspace_id: workspaceId,
        scope: input.scope,
        entity_id: input.entityId,
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
      guided_response: input.response,
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
    entityId: row.entity_id,
    baseVersion: row.base_version,
    currentStep: row.current_step,
    completedSteps: row.completed_steps,
    draftData: row.draft_data,
    status: row.status,
  };
}
