import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { ExportRecord, UsageEvent } from "@/types/domain";
import { createHash } from "node:crypto";

export async function saveRecipientSelection(
  workspaceId: string,
  input: { leadId: string; contactRouteId: string | null; reason: string },
) {
  const { supabase, user } = await createAuthenticatedDatabaseClient();
  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("id", input.leadId)
    .single();
  if (associationError)
    throw new Error(`Could not load Campaign company: ${associationError.message}`);

  const { error: resetError } = await supabase
    .from("campaign_contacts")
    .update({
      selection_status: "candidate",
      approved_by: null,
      approved_at: null,
    })
    .eq("workspace_id", workspaceId)
    .eq("campaign_company_id", association.id);
  if (resetError)
    throw new Error(`Could not reset recipient selection: ${resetError.message}`);
  if (!input.contactRouteId) return;

  const { data: selected, error } = await supabase
    .from("campaign_contacts")
    .update({
      selection_status: "selected",
      recommendation_reason: input.reason,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("campaign_company_id", association.id)
    .eq("contact_method_id", input.contactRouteId)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`Could not save recipient selection: ${error.message}`);
  if (!selected)
    throw new Error(
      "Selected contact method is not available for this Campaign company.",
    );
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
  const supabase = createServiceRoleClient();
  const campaign = await resolveCampaign(supabase, workspaceId, input.campaignId);
  const { data, error } = await supabase
    .from("export_records")
    .insert({
      workspace_id: workspaceId,
      campaign_id: campaign.id,
      export_type:
        input.type === "lead_research_csv" ? "company_research_csv" : "outreach_csv",
      file_name: input.fileName,
      row_count: input.rows.length,
      payload: input.rows,
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
  const campaign = await resolveCampaign(supabase, workspaceId, campaignId);
  const { data, error } = await supabase
    .from("export_records")
    .select("id,export_type,file_name,row_count,created_at,created_by")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load exports: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    campaignId,
    type:
      row.export_type === "company_research_csv" ? "lead_research_csv" : "outreach_csv",
    fileName: row.file_name,
    rowCount: row.row_count,
    createdAt: row.created_at,
    creator: row.created_by ?? "Unknown",
  }));
}

export async function getExportRecord(
  workspaceId: string,
  exportId: string,
): Promise<{
  id: string;
  type: ExportRecord["type"];
  fileName: string;
  rows: unknown[];
} | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("export_records")
    .select("id,export_type,file_name,payload")
    .eq("workspace_id", workspaceId)
    .eq("id", exportId)
    .maybeSingle();
  if (error) throw new Error(`Could not load export: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    type:
      data.export_type === "company_research_csv" ? "lead_research_csv" : "outreach_csv",
    fileName: data.file_name,
    rows: Array.isArray(data.payload) ? data.payload : [],
  };
}

export async function recordUsageEvent(
  workspaceId: string,
  userId: string,
  input: {
    campaignId?: string;
    operation: string;
    estimatedUnits: number;
    actualUnits: number;
    referenceId?: string;
  },
) {
  const supabase = createServiceRoleClient();
  const campaignRunId = input.campaignId
    ? await resolveLatestCampaignRunId(supabase, workspaceId, input.campaignId)
    : null;
  const eventKey = createHash("sha256")
    .update(
      [
        workspaceId,
        input.operation,
        input.referenceId ?? "",
        input.campaignId ?? "",
      ].join(":"),
    )
    .digest("hex");
  const metadata = {
    campaign_external_id: input.campaignId ?? null,
    reference_id: input.referenceId ?? null,
    created_by: userId,
    estimated_units: input.estimatedUnits,
    actual_units: input.actualUnits,
  };
  const entries = [
    {
      workspace_id: workspaceId,
      campaign_run_id: campaignRunId,
      operation: input.operation,
      entry_type: "estimate" as const,
      idempotency_key: `${eventKey}:estimate`,
      credits: 0,
      metadata,
    },
    {
      workspace_id: workspaceId,
      campaign_run_id: campaignRunId,
      operation: input.operation,
      entry_type: "settlement" as const,
      idempotency_key: `${eventKey}:settlement`,
      credits: 0,
      metadata,
    },
  ];
  const { error } = await supabase
    .from("usage_ledger")
    .upsert(entries, { onConflict: "workspace_id,entry_type,idempotency_key" });
  if (error) throw new Error(`Could not record usage: ${error.message}`);
}

export async function listUsageEvents(workspaceId: string): Promise<UsageEvent[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("usage_ledger")
    .select("id,operation,entry_type,credits,created_at,metadata")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(`Could not load usage: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: row.id,
    campaignId: readMetadataString(row.metadata, "campaign_external_id"),
    operation: row.operation,
    estimatedUnits:
      row.entry_type === "estimate"
        ? readMetadataNumber(row.metadata, "estimated_units")
        : 0,
    actualUnits:
      row.entry_type === "settlement"
        ? readMetadataNumber(row.metadata, "actual_units")
        : 0,
    createdAt: row.created_at,
  }));
}

type DatabaseClient = Awaited<
  ReturnType<typeof createAuthenticatedDatabaseClient>
>["supabase"];

async function resolveCampaign(
  supabase: DatabaseClient,
  workspaceId: string,
  externalId: string,
) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .single();
  if (error) throw new Error(`Could not resolve Campaign: ${error.message}`);
  return data;
}

async function resolveLatestCampaignRunId(
  supabase: DatabaseClient,
  workspaceId: string,
  campaignExternalId: string,
) {
  const campaign = await resolveCampaign(supabase, workspaceId, campaignExternalId);
  const { data, error } = await supabase
    .from("campaign_runs")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve Campaign Run: ${error.message}`);
  return data?.id ?? null;
}

function readMetadataString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : null;
}

function readMetadataNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : 0;
}
