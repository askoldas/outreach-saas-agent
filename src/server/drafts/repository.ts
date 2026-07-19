import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { DraftStatus, OutreachDraft } from "@/types/domain";

type DraftVariant = OutreachDraft["variant"];

type DraftRow = {
  body: string;
  campaign_external_id: string;
  evidence_used: string[];
  external_id: string;
  language: string;
  last_edited_label: string;
  lead_external_id: string;
  recipient_route: string;
  seller_claims: string[];
  status: DraftStatus;
  subject: string;
  variant: DraftVariant;
  warnings: string[];
  prompt_version: string | null;
  generated_at: string | null;
};

type UpdateDraftInput = {
  body: string;
  status: DraftStatus;
  subject: string;
};

const draftSelect = `
  external_id,
  lead_external_id,
  campaign_external_id,
  recipient_route,
  subject,
  body,
  variant,
  language,
  status,
  last_edited_label,
  seller_claims,
  evidence_used,
  warnings,
  prompt_version,
  generated_at
`;

export async function listDrafts(workspaceId: string): Promise<OutreachDraft[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .select(draftSelect)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Could not load drafts: ${error.message}`);
  }

  return ((data ?? []) as DraftRow[]).map(mapDraft);
}

export async function listCampaignDrafts(
  workspaceId: string,
  campaignId: string,
): Promise<OutreachDraft[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .select(draftSelect)
    .eq("workspace_id", workspaceId)
    .eq("campaign_external_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load campaign drafts: ${error.message}`);
  return ((data ?? []) as DraftRow[]).map(mapDraft);
}

export async function getDraft(
  workspaceId: string,
  draftId: string,
): Promise<OutreachDraft | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .select(draftSelect)
    .eq("workspace_id", workspaceId)
    .eq("external_id", draftId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load draft: ${error.message}`);
  }

  return data ? mapDraft(data as DraftRow) : null;
}

export async function updateDraft(
  workspaceId: string,
  draftId: string,
  input: UpdateDraftInput,
): Promise<OutreachDraft> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .update({
      body: input.body,
      last_edited_label: "Just now",
      status: input.status,
      subject: input.subject,
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", draftId)
    .select(draftSelect)
    .single();

  if (error) {
    throw new Error(`Could not update draft: ${error.message}`);
  }

  return mapDraft(data as DraftRow);
}

function mapDraft(row: DraftRow): OutreachDraft {
  return {
    body: row.body,
    campaignId: row.campaign_external_id,
    evidenceUsed: row.evidence_used,
    id: row.external_id,
    language: row.language,
    lastEdited: row.last_edited_label,
    leadId: row.lead_external_id,
    recipientRoute: row.recipient_route,
    sellerClaims: row.seller_claims,
    status: row.status,
    subject: row.subject,
    variant: row.variant,
    warnings: row.warnings,
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
  };
}
