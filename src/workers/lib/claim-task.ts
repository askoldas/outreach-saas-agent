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

  return data ? (data as ResearchTaskRow) : null;
}
