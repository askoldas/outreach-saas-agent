import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { leads as sampleLeads } from "@/data/mock/prospecting";
import type {
  Confidence,
  ContactRoute,
  EvidenceClaim,
  EvidenceKind,
  Lead,
  LeadStatus,
  QualificationDimension,
} from "@/types/domain";

type LeadRow = {
  campaign_id: string | null;
  city: string;
  company: string;
  company_type: string;
  confidence: Confidence;
  contactability: Confidence;
  country: string;
  description: string;
  estimated_size: string;
  external_id: string;
  fit_score: number;
  industry: string;
  lead_contact_routes: ContactRouteRow[] | null;
  lead_evidence_claims: EvidenceClaimRow[] | null;
  lead_qualification_dimensions: QualificationDimensionRow[] | null;
  status: LeadStatus;
  summary: string;
  website: string;
};

type QualificationDimensionRow = {
  confidence: Confidence;
  explanation: string;
  label: string;
  score: number;
  sort_order: number;
};

type EvidenceClaimRow = {
  confidence: Confidence;
  external_id: string;
  kind: EvidenceKind;
  retrieved_at: string;
  sort_order: number;
  source_label: string;
  source_type: string;
  source_url: string;
  text: string;
};

type ContactRouteRow = {
  sort_order: number;
  source: string;
  suggested_role: string;
  type: string;
  value: string;
  verification: ContactRoute["verification"];
};

type PersistedLeadIdentifier = {
  external_id: string;
  id: string;
};

const leadSelect = `
  external_id,
  company,
  website,
  country,
  city,
  campaign_id,
  company_type,
  industry,
  estimated_size,
  description,
  fit_score,
  confidence,
  contactability,
  status,
  summary,
  lead_qualification_dimensions (
    label,
    score,
    confidence,
    explanation,
    sort_order
  ),
  lead_evidence_claims (
    external_id,
    kind,
    text,
    source_type,
    source_label,
    source_url,
    retrieved_at,
    confidence,
    sort_order
  ),
  lead_contact_routes (
    type,
    value,
    suggested_role,
    verification,
    source,
    sort_order
  )
`;

export async function listLeads(workspaceId: string): Promise<Lead[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select(leadSelect)
    .eq("workspace_id", workspaceId)
    .order("fit_score", { ascending: false })
    .order("company", { ascending: true });

  if (error) {
    throw new Error(`Could not load leads: ${error.message}`);
  }

  return ((data ?? []) as LeadRow[]).map(mapLead);
}

export async function getLead(workspaceId: string, leadId: string): Promise<Lead | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select(leadSelect)
    .eq("workspace_id", workspaceId)
    .eq("external_id", leadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load lead: ${error.message}`);
  }

  return data ? mapLead(data as LeadRow) : null;
}

export async function importSampleLeads(workspaceId: string): Promise<number> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .upsert(
      sampleLeads.map((lead) => ({
        campaign_id: lead.campaignId,
        city: lead.city,
        company: lead.company,
        company_type: lead.companyType,
        confidence: lead.confidence,
        contactability: lead.contactability,
        country: lead.country,
        description: lead.description,
        estimated_size: lead.estimatedSize,
        external_id: lead.id,
        fit_score: lead.fitScore,
        industry: lead.industry,
        status: lead.status,
        summary: lead.summary,
        website: lead.website,
        workspace_id: workspaceId,
      })),
      { onConflict: "workspace_id,external_id" },
    )
    .select("id,external_id");

  if (error) {
    throw new Error(`Could not import sample leads: ${error.message}`);
  }

  const persistedLeads = (data ?? []) as PersistedLeadIdentifier[];
  const leadIds = persistedLeads.map((lead) => lead.id);
  const leadIdByExternalId = new Map(
    persistedLeads.map((lead) => [lead.external_id, lead.id]),
  );

  if (leadIds.length === 0) {
    return 0;
  }

  await replaceLeadChildren(
    "lead_qualification_dimensions",
    leadIds,
    sampleLeads.flatMap((lead) => {
      const leadId = leadIdByExternalId.get(lead.id);
      return leadId
        ? lead.qualification.map((item, index) => ({
            confidence: item.confidence,
            explanation: item.explanation,
            label: item.label,
            lead_id: leadId,
            score: item.score,
            sort_order: index,
          }))
        : [];
    }),
  );

  await replaceLeadChildren(
    "lead_evidence_claims",
    leadIds,
    sampleLeads.flatMap((lead) => {
      const leadId = leadIdByExternalId.get(lead.id);
      return leadId
        ? lead.evidence.map((item, index) => ({
            confidence: item.confidence,
            external_id: item.id,
            kind: item.kind,
            lead_id: leadId,
            retrieved_at: item.retrievedAt,
            sort_order: index,
            source_label: item.sourceLabel,
            source_type: item.sourceType,
            source_url: item.sourceUrl,
            text: item.text,
          }))
        : [];
    }),
  );

  await replaceLeadChildren(
    "lead_contact_routes",
    leadIds,
    sampleLeads.flatMap((lead) => {
      const leadId = leadIdByExternalId.get(lead.id);
      return leadId
        ? lead.contacts.map((item, index) => ({
            lead_id: leadId,
            sort_order: index,
            source: item.source,
            suggested_role: item.suggestedRole,
            type: item.type,
            value: item.value,
            verification: item.verification,
          }))
        : [];
    }),
  );

  return persistedLeads.length;
}

function mapLead(row: LeadRow): Lead {
  return {
    campaignId: row.campaign_id ?? "",
    city: row.city,
    company: row.company,
    companyType: row.company_type,
    confidence: row.confidence,
    contactability: row.contactability,
    contacts: mapContacts(row.lead_contact_routes),
    country: row.country,
    description: row.description,
    estimatedSize: row.estimated_size,
    evidence: mapEvidence(row.lead_evidence_claims),
    fitScore: row.fit_score,
    id: row.external_id,
    industry: row.industry,
    qualification: mapQualification(row.lead_qualification_dimensions),
    status: row.status,
    summary: row.summary,
    website: row.website,
  };
}

function mapQualification(
  rows: QualificationDimensionRow[] | null,
): QualificationDimension[] {
  return sortByOrder(rows).map((row) => ({
    confidence: row.confidence,
    explanation: row.explanation,
    label: row.label,
    score: row.score,
  }));
}

function mapEvidence(rows: EvidenceClaimRow[] | null): EvidenceClaim[] {
  return sortByOrder(rows).map((row) => ({
    confidence: row.confidence,
    id: row.external_id,
    kind: row.kind,
    retrievedAt: row.retrieved_at,
    sourceLabel: row.source_label,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    text: row.text,
  }));
}

function mapContacts(rows: ContactRouteRow[] | null): ContactRoute[] {
  return sortByOrder(rows).map((row) => ({
    source: row.source,
    suggestedRole: row.suggested_role,
    type: row.type,
    value: row.value,
    verification: row.verification,
  }));
}

function sortByOrder<T extends { sort_order: number }>(rows: T[] | null): T[] {
  return [...(rows ?? [])].sort((first, second) => first.sort_order - second.sort_order);
}

async function replaceLeadChildren<Row extends { lead_id: string }>(
  table: "lead_contact_routes" | "lead_evidence_claims" | "lead_qualification_dimensions",
  leadIds: string[],
  rows: Row[],
) {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error: deleteError } = await supabase
    .from(table)
    .delete()
    .in("lead_id", leadIds);

  if (deleteError) {
    throw new Error(`Could not refresh sample lead records: ${deleteError.message}`);
  }

  if (rows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from(table).insert(rows);

  if (insertError) {
    throw new Error(`Could not save sample lead records: ${insertError.message}`);
  }
}
