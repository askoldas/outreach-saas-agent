import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { ExportRecord, UsageEvent } from "@/types/domain";

export async function saveRecipientSelection(
  workspaceId: string,
  input: { leadId: string; contactRouteId: string | null; reason: string },
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", input.leadId)
    .single();
  if (leadError) throw new Error(`Could not load lead: ${leadError.message}`);
  const { error } = await supabase.from("lead_outreach_states").upsert(
    {
      workspace_id: workspaceId,
      lead_id: (lead as { id: string }).id,
      selected_contact_route_id: input.contactRouteId,
      selection_status: input.contactRouteId ? "accepted" : "no_route",
      recommendation_reason: input.reason,
    },
    { onConflict: "lead_id" },
  );
  if (error) throw new Error(`Could not save recipient selection: ${error.message}`);
}

export async function createExportRecord(
  workspaceId: string,
  userId: string,
  input: {
    campaignId: string;
    type: "outreach_csv" | "lead_research_csv";
    fileName: string;
    rows: unknown[];
  },
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("export_records")
    .insert({
      workspace_id: workspaceId,
      campaign_external_id: input.campaignId,
      export_type: input.type,
      file_name: input.fileName,
      row_count: input.rows.length,
      payload_json: input.rows,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Could not save export: ${error.message}`);
  return (data as { id: string }).id;
}

export async function listCampaignExports(
  workspaceId: string,
  campaignId: string,
): Promise<ExportRecord[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("export_records")
    .select(
      "id,campaign_external_id,export_type,file_name,row_count,created_at,created_by",
    )
    .eq("workspace_id", workspaceId)
    .eq("campaign_external_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load exports: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_external_id,
    type: row.export_type as ExportRecord["type"],
    fileName: row.file_name,
    rowCount: row.row_count,
    createdAt: row.created_at,
    creator: row.created_by ?? "Unknown",
  }));
}

export async function getExportRecord(workspaceId: string, exportId: string) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("export_records")
    .select("id,export_type,file_name,payload_json")
    .eq("workspace_id", workspaceId)
    .eq("id", exportId)
    .maybeSingle();
  if (error) throw new Error(`Could not load export: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    type: data.export_type as ExportRecord["type"],
    fileName: data.file_name,
    rows: Array.isArray(data.payload_json) ? data.payload_json : [],
  };
}

export async function recordUsageEvent(
  workspaceId: string,
  userId: string,
  input: {
    campaignId?: string;
    operation: string;
    estimated: number;
    actual: number;
    referenceId?: string;
  },
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase.from("usage_events").insert({
    workspace_id: workspaceId,
    campaign_external_id: input.campaignId ?? null,
    operation: input.operation,
    estimated_credits: input.estimated,
    actual_credits: input.actual,
    reference_type: input.referenceId ? "operation" : null,
    reference_id: input.referenceId ?? null,
    created_by: userId,
  });
  if (error) throw new Error(`Could not record usage: ${error.message}`);
}

export async function listUsageEvents(workspaceId: string): Promise<UsageEvent[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("usage_events")
    .select(
      "id,campaign_external_id,operation,estimated_credits,actual_credits,created_at",
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load usage: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    campaignId: row.campaign_external_id,
    operation: row.operation,
    estimatedCredits: row.estimated_credits,
    actualCredits: row.actual_credits,
    createdAt: row.created_at,
  }));
}
