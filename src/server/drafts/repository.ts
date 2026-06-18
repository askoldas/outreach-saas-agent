import { drafts as sampleDrafts } from "@/data/mock/prospecting";
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
  warnings
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

export async function importSampleDrafts(workspaceId: string): Promise<number> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("outreach_drafts")
    .upsert(
      sampleDrafts.map((draft) => ({
        body: draft.body,
        campaign_external_id: draft.campaignId,
        evidence_used: draft.evidenceUsed,
        external_id: draft.id,
        language: draft.language,
        last_edited_label: draft.lastEdited,
        lead_external_id: draft.leadId,
        recipient_route: draft.recipientRoute,
        seller_claims: draft.sellerClaims,
        status: draft.status,
        subject: draft.subject,
        variant: draft.variant,
        warnings: draft.warnings,
        workspace_id: workspaceId,
      })),
      { onConflict: "workspace_id,external_id" },
    )
    .select("id");

  if (error) {
    throw new Error(`Could not import sample drafts: ${error.message}`);
  }

  return data?.length ?? 0;
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
  };
}
