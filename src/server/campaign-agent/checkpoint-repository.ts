import type { Json } from "@/types/database.types";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { CampaignAgentState } from "@/lib/campaign-agent/loop";

export async function saveCampaignAgentCheckpoint(input: {
  campaignRunId: string;
  state: CampaignAgentState;
  workspaceId: string;
}) {
  const { error } = await createServiceRoleClient()
    .from("campaign_agent_checkpoints")
    .upsert(
      {
        workspace_id: input.workspaceId,
        campaign_run_id: input.campaignRunId,
        iteration: input.state.iteration,
        phase: input.state.phase,
        state: input.state as unknown as Json,
      },
      { onConflict: "campaign_run_id,iteration,phase" },
    );
  if (error)
    throw new Error(`Could not save Campaign Agent checkpoint: ${error.message}`);
}

export async function loadLatestCampaignAgentCheckpoint(input: {
  campaignRunId: string;
  workspaceId: string;
}) {
  const { data, error } = await createServiceRoleClient()
    .from("campaign_agent_checkpoints")
    .select("state")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_run_id", input.campaignRunId)
    .in("phase", ["refine", "gate"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error)
    throw new Error(`Could not load Campaign Agent checkpoint: ${error.message}`);
  return data?.state ? (data.state as unknown as CampaignAgentState) : null;
}
