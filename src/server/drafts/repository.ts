import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { DraftStatus, OutreachDraft } from "@/types/domain";

type DraftVariant = OutreachDraft["variant"];

type DraftRow = {
  body: string;
  campaign: { external_id: string };
  campaign_company_id: string;
  campaign_contact: {
    contact_method: { value: string } | null;
  } | null;
  evidence_used: string[];
  id: string;
  language: string;
  seller_claims: string[];
  status: DraftStatus;
  subject: string;
  updated_at: string;
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
  id,
  campaign_company_id,
  campaign:campaigns!inner (external_id),
  campaign_contact:campaign_contacts (
    contact_method:contact_methods (value)
  ),
  subject,
  body,
  variant,
  language,
  status,
  updated_at,
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

  return ((data ?? []) as unknown as DraftRow[]).map(mapDraft);
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
    .eq("campaign.external_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Could not load campaign drafts: ${error.message}`);
  return ((data ?? []) as unknown as DraftRow[]).map(mapDraft);
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
    .eq("id", draftId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load draft: ${error.message}`);
  }

  return data ? mapDraft(data as unknown as DraftRow) : null;
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
      status: input.status,
      subject: input.subject,
    })
    .eq("workspace_id", workspaceId)
    .eq("id", draftId)
    .select(draftSelect)
    .single();

  if (error) {
    throw new Error(`Could not update draft: ${error.message}`);
  }

  return mapDraft(data as unknown as DraftRow);
}

function mapDraft(row: DraftRow): OutreachDraft {
  return {
    body: row.body,
    campaignId: row.campaign.external_id,
    evidenceUsed: row.evidence_used,
    id: row.id,
    language: row.language,
    lastEdited: row.updated_at,
    leadId: row.campaign_company_id,
    recipientRoute: row.campaign_contact?.contact_method?.value ?? "",
    sellerClaims: row.seller_claims,
    status: row.status,
    subject: row.subject,
    variant: row.variant,
    warnings: row.warnings,
    promptVersion: row.prompt_version,
    generatedAt: row.generated_at,
  };
}
