import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ActivityItem } from "@/types/domain";

type ActivityEntityType = "campaign" | "draft" | "lead" | "workspace";

type ActivityEventRow = {
  created_at: string;
  description: string;
  id: string;
  label: string;
};

type CreateActivityEventInput = {
  description: string;
  entityExternalId?: string;
  entityType: ActivityEntityType;
  label: string;
};

export async function listActivityEvents(
  workspaceId: string,
  limit = 8,
): Promise<ActivityItem[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id,label,description,created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Could not load activity: ${error.message}`);
  }

  return ((data ?? []) as ActivityEventRow[]).map((row) => ({
    description: row.description,
    id: row.id,
    label: row.label,
    time: formatRelativeTime(row.created_at),
  }));
}

export async function createActivityEvent(
  workspaceId: string,
  input: CreateActivityEventInput,
) {
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const entityId = await resolveEntityId(
    supabase,
    workspaceId,
    input.entityType,
    input.entityExternalId,
  );
  const { error } = await supabase.from("activity_events").insert({
    actor_user_id: user.id,
    description: input.description,
    entity_id: entityId,
    entity_type: input.entityType,
    event_type: toEventType(input.label),
    label: input.label,
    metadata: input.entityExternalId ? { externalEntityId: input.entityExternalId } : {},
    workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(`Could not create activity event: ${error.message}`);
  }
}

type DatabaseClient = Awaited<
  ReturnType<typeof createAuthenticatedDatabaseClient>
>["supabase"];

async function resolveEntityId(
  supabase: DatabaseClient,
  workspaceId: string,
  entityType: ActivityEntityType,
  externalId?: string,
) {
  if (!externalId) return null;
  if (entityType === "workspace") return externalId === workspaceId ? workspaceId : null;
  if (entityType !== "campaign") return isUuid(externalId) ? externalId : null;
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve activity Campaign: ${error.message}`);
  return data?.id ?? null;
}

function toEventType(label: string) {
  return (
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "activity"
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  if (diffSeconds < 60) {
    return "Just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
