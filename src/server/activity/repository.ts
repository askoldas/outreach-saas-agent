import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ActivityItem } from "@/types/domain";

type ActivityEntityType = "campaign" | "draft" | "lead" | "offer" | "workspace";

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
  const { error } = await supabase.from("activity_events").insert({
    actor_user_id: user.id,
    description: input.description,
    entity_external_id: input.entityExternalId ?? null,
    entity_type: input.entityType,
    label: input.label,
    workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(`Could not create activity event: ${error.message}`);
  }
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
