import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";

export type OpenCampaignQuestion = {
  campaignRunId: string;
  id: string;
  question: string;
};

export async function getOpenCampaignQuestion(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<OpenCampaignQuestion | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("external_id", input.campaignId)
    .maybeSingle();
  if (campaignError)
    throw new Error(`Could not load Campaign question context: ${campaignError.message}`);
  if (!campaign) return null;
  const { data, error } = await supabase
    .from("campaign_questions")
    .select("id,question,campaign_run_id,campaign_runs!inner(campaign_id)")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_runs.campaign_id", campaign.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load Campaign question: ${error.message}`);
  return data
    ? { campaignRunId: data.campaign_run_id, id: data.id, question: data.question }
    : null;
}
