import { task } from "@trigger.dev/sdk";
import { createServiceRoleClient } from "@/lib/supabase/service";

export type VerifyCampaignRunPayload = {
  campaignRunId?: string;
};

export const verifyCampaignRunTask = task({
  id: "verify-campaign-run",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1_000,
    maxTimeoutInMs: 10_000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: VerifyCampaignRunPayload) => {
    const supabase = createServiceRoleClient();
    let query = supabase
      .from("campaign_runs")
      .select("id,workspace_id,campaign_id,status,current_phase")
      .order("created_at", { ascending: false })
      .limit(1);

    if (payload.campaignRunId) {
      query = query.eq("id", payload.campaignRunId);
    }

    const { data: runs, error: runError } = await query;

    if (runError) {
      throw new Error(`Could not query campaign runs: ${runError.message}`);
    }

    const run = runs[0];
    if (!run) {
      return {
        connected: true,
        campaignRunId: null,
        verified: true,
      };
    }

    const { error: eventError } = await supabase.from("campaign_run_events").insert({
      workspace_id: run.workspace_id,
      campaign_run_id: run.id,
      event_type: "trigger_runtime_verified",
      phase: run.current_phase,
      level: "info",
      summary: "Trigger.dev successfully connected to the clean Supabase project.",
      details: {
        campaignId: run.campaign_id,
        priorStatus: run.status,
        taskId: "verify-campaign-run",
      },
      visible_to_user: true,
    });

    if (eventError) {
      throw new Error(`Could not record campaign run event: ${eventError.message}`);
    }

    return {
      campaignId: run.campaign_id,
      campaignRunId: run.id,
      connected: true,
      workspaceId: run.workspace_id,
      verified: true,
    };
  },
});
