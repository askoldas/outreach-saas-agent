import { createServiceRoleClient } from "@/lib/supabase/service";

export async function recordIntelligenceCacheHit(input: {
  workspaceId: string;
  taskId: string;
  cacheKey: string;
  metadata?: Record<string, unknown>;
}) {
  type EventTable = {
    from(name: "intelligence_runtime_events"): {
      insert(value: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
  };
  const { error } = await (createServiceRoleClient() as unknown as EventTable)
    .from("intelligence_runtime_events")
    .insert({
      workspace_id: input.workspaceId,
      task_id: input.taskId,
      event_type: "cache_hit",
      cache_key: input.cacheKey,
      metadata: input.metadata ?? {},
    });
  if (error) throw new Error(`Could not record Intelligence cache hit: ${error.message}`);
}

