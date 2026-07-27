import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";

export type CampaignMemory = {
  approvalStatus: string;
  category: string;
  confidence: string;
  id: string;
  statement: string;
};

export async function listCampaignMemories(input: {
  campaignId: string;
  workspaceId: string;
}): Promise<CampaignMemory[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaign_memories")
    .select(
      "id,category,statement,confidence,approval_status,campaigns!inner(external_id)",
    )
    .eq("workspace_id", input.workspaceId)
    .eq("campaigns.external_id", input.campaignId)
    .neq("approval_status", "rejected")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Could not load Campaign learnings: ${error.message}`);
  return (data ?? []).map((item) => ({
    approvalStatus: item.approval_status,
    category: item.category,
    confidence: item.confidence,
    id: item.id,
    statement: item.statement,
  }));
}
