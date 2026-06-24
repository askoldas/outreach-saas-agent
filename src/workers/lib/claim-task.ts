import type { SupabaseClient } from "@supabase/supabase-js";

export type ResearchTaskRow = {
  attempt_count: number;
  campaign_id: string;
  id: string;
  max_attempts: number;
  payload_json: Record<string, unknown>;
  run_id: string;
  task_type: string;
  workspace_id: string;
};

export async function claimNextResearchTask(
  supabase: SupabaseClient,
  workerId: string,
): Promise<ResearchTaskRow | null> {
  const { data, error } = await supabase.rpc("claim_next_research_task", {
    worker_id: workerId,
  });

  if (error) {
    throw new Error(`Could not claim research task: ${error.message}`);
  }

  if (!data || !isClaimedTask(data)) {
    return null;
  }

  return data;
}

function isClaimedTask(data: unknown): data is ResearchTaskRow {
  return (
    typeof data === "object" &&
    data !== null &&
    "id" in data &&
    typeof data.id === "string" &&
    data.id.length > 0 &&
    "task_type" in data &&
    typeof data.task_type === "string" &&
    data.task_type.length > 0
  );
}
