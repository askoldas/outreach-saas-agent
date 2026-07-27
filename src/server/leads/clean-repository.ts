import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type {
  Confidence,
  ContactRoute,
  EvidenceClaim,
  EvidenceKind,
  Lead,
  LeadQualificationStatus,
  LeadStatus,
  QualificationDimension,
} from "@/types/domain";

type JsonObject = Record<string, unknown>;

type CleanQualificationResult = NonNullable<
  CleanCampaignCompanyRow["qualification_results"]
>[number];

type CleanCampaignCompanyRow = {
  id: string;
  campaign_id: string;
  campaign: {
    external_id: string;
  };
  status: string;
  source_summary: string;
  user_notes: string;
  metadata: JsonObject;
  company: {
    id: string;
    name: string;
    website_url: string | null;
    country: string | null;
    city: string | null;
    industry: string | null;
    company_type: string | null;
    estimated_size: string | null;
    description: string;
    metadata: JsonObject;
    company_sources: Array<{
      id: string;
      source_type: string;
      provider: string;
      source_url: string;
      title: string;
      excerpt: string;
      retrieved_at: string;
      metadata: JsonObject;
    }> | null;
  };
  qualification_results: Array<{
    id: string;
    status: string;
    score: number;
    confidence: Confidence;
    summary: string;
    created_at: string;
    qualification_dimensions: Array<{
      id: string;
      criterion: string;
      score: number;
      confidence: Confidence;
      explanation: string;
    }> | null;
    qualification_evidence: Array<{
      id: string;
      evidence_kind: EvidenceKind;
      statement: string;
      source_url: string | null;
      confidence: Confidence;
      created_at: string;
      metadata: JsonObject;
    }> | null;
  }> | null;
  campaign_contacts: Array<{
    id: string;
    role_relevance: string;
    contact: {
      full_name: string | null;
      job_title: string | null;
      department: string | null;
    } | null;
    contact_method: {
      id: string;
      method_type: string;
      value: string;
      verification_status: string;
      metadata: JsonObject;
    } | null;
  }> | null;
};

const cleanLeadSelect = `
  id,
  campaign_id,
  campaign:campaigns!inner (
    external_id
  ),
  status,
  source_summary,
  user_notes,
  metadata,
  company:companies!inner (
    id,
    name,
    website_url,
    country,
    city,
    industry,
    company_type,
    estimated_size,
    description,
    metadata,
    company_sources (
      id,
      source_type,
      provider,
      source_url,
      title,
      excerpt,
      retrieved_at,
      metadata
    )
  ),
  qualification_results (
    id,
    status,
    score,
    confidence,
    summary,
    created_at,
    qualification_dimensions (
      id,
      criterion,
      score,
      confidence,
      explanation
    ),
    qualification_evidence (
      id,
      evidence_kind,
      statement,
      source_url,
      confidence,
      created_at,
      metadata
    )
  ),
  campaign_contacts (
    id,
    role_relevance,
    contact:contacts (
      full_name,
      job_title,
      department
    ),
    contact_method:contact_methods (
      id,
      method_type,
      value,
      verification_status,
      metadata
    )
  )
`;

export async function listCleanLeads(
  workspaceId: string,
  campaignId?: string,
): Promise<Lead[]> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  let query = supabase
    .from("campaign_companies")
    .select(cleanLeadSelect)
    .eq("workspace_id", workspaceId);

  if (campaignId) query = query.eq("campaign.external_id", campaignId);

  const { data, error } = await query.order("first_discovered_at", {
    ascending: false,
  });
  if (error) throw new Error(`Could not load companies: ${error.message}`);

  return ((data ?? []) as unknown as CleanCampaignCompanyRow[])
    .map(mapCleanLead)
    .sort(
      (left, right) =>
        right.fitScore - left.fitScore || left.company.localeCompare(right.company),
    );
}

export async function getCleanLead(
  workspaceId: string,
  campaignCompanyId: string,
): Promise<Lead | null> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaign_companies")
    .select(cleanLeadSelect)
    .eq("workspace_id", workspaceId)
    .eq("id", campaignCompanyId)
    .maybeSingle();

  if (error) throw new Error(`Could not load company: ${error.message}`);
  return data ? mapCleanLead(data as unknown as CleanCampaignCompanyRow) : null;
}

export async function updateCleanLeadStatus(
  workspaceId: string,
  campaignCompanyId: string,
  status: LeadStatus,
): Promise<Lead> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaign_companies")
    .update({ status: toCleanStatus(status) })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignCompanyId)
    .select(cleanLeadSelect)
    .single();

  if (error) throw new Error(`Could not update company: ${error.message}`);
  return mapCleanLead(data as unknown as CleanCampaignCompanyRow);
}

export async function getCleanCampaignLeadCounts(
  workspaceId: string,
  campaignId: string,
): Promise<{ awaitingReview: number; total: number }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("campaign_companies")
    .select("status,campaign:campaigns!inner(external_id)")
    .eq("workspace_id", workspaceId)
    .eq("campaign.external_id", campaignId);

  if (error) throw new Error(`Could not count campaign companies: ${error.message}`);
  const rows = (data ?? []) as Array<{ status: string }>;
  return {
    awaitingReview: rows.filter((row) =>
      ["discovered", "researching", "needs_review"].includes(row.status),
    ).length,
    total: rows.length,
  };
}

function mapCleanLead(row: CleanCampaignCompanyRow): Lead {
  const qualifications = [...(row.qualification_results ?? [])].sort((left, right) =>
    right.created_at.localeCompare(left.created_at),
  );
  const qualification = qualifications[0];
  const sources = row.company.company_sources ?? [];
  const contacts = (row.campaign_contacts ?? []).flatMap((selection) => {
    const method = selection.contact_method;
    if (!method) return [];
    const contact = selection.contact;
    const metadata = method.metadata ?? {};
    return [
      {
        id: method.id,
        type: method.method_type,
        value: method.value,
        suggestedRole:
          selection.role_relevance ||
          contact?.job_title ||
          contact?.department ||
          contact?.full_name ||
          "",
        verification: mapVerification(method.verification_status),
        source: stringValue(metadata.source) || "Stored contact method",
        verificationProvenance: null,
      } satisfies ContactRoute,
    ];
  });

  return {
    id: row.id,
    company: row.company.name,
    website: row.company.website_url ?? "",
    country: row.company.country ?? "",
    city: row.company.city ?? "",
    campaignId: row.campaign.external_id,
    companyType: row.company.company_type ?? "",
    industry: row.company.industry ?? "",
    estimatedSize: row.company.estimated_size ?? "",
    description: row.company.description,
    fitScore: qualification?.score ?? 0,
    confidence: qualification?.confidence ?? "low",
    contactability: contacts.length > 0 ? "high" : "low",
    contactDiscoveryStatus: contacts.length > 0 ? "completed" : "not_run",
    qualificationError: stringValue(row.metadata.qualification_error),
    qualificationStatus: mapQualificationStatus(qualification?.status),
    status: fromCleanStatus(row.status),
    summary: qualification?.summary || row.source_summary || row.company.description,
    userNotes: row.user_notes,
    qualification: mapDimensions(qualification?.qualification_dimensions),
    evidence: mapEvidence(qualification?.qualification_evidence, sources),
    contacts,
  };
}

function mapDimensions(
  rows: CleanQualificationResult["qualification_dimensions"] | undefined,
): QualificationDimension[] {
  return (rows ?? []).map((row) => ({
    label: row.criterion,
    score: row.score,
    confidence: row.confidence,
    explanation: row.explanation,
  }));
}

function mapEvidence(
  rows: CleanQualificationResult["qualification_evidence"] | undefined,
  sources: NonNullable<CleanCampaignCompanyRow["company"]["company_sources"]>,
): EvidenceClaim[] {
  if (rows?.length) {
    return rows.map((row) => ({
      id: row.id,
      kind: row.evidence_kind,
      text: row.statement,
      sourceType: stringValue(row.metadata.source_type) || "qualification",
      sourceLabel: stringValue(row.metadata.source_label) || "Qualification evidence",
      sourceUrl: row.source_url ?? "",
      retrievedAt: row.created_at,
      confidence: row.confidence,
    }));
  }

  return sources.map((source) => ({
    id: source.id,
    kind: "fact",
    text: source.excerpt || source.title,
    sourceType: source.source_type,
    sourceLabel: source.title || source.provider,
    sourceUrl: source.source_url,
    retrievedAt: source.retrieved_at,
    confidence: "medium",
  }));
}

function toCleanStatus(status: LeadStatus) {
  if (status === "rejected") return "rejected";
  return status;
}

function fromCleanStatus(status: string): LeadStatus {
  if (status === "discovered") return "needs_review";
  if (status === "excluded") return "rejected";
  if (
    [
      "needs_review",
      "approved",
      "rejected",
      "draft_ready",
      "researching",
      "archived",
    ].includes(status)
  )
    return status as LeadStatus;
  return "needs_review";
}

function mapQualificationStatus(status?: string): LeadQualificationStatus {
  if (status === "qualified" || status === "highly_relevant") return "qualified";
  if (status === "not_relevant" || status === "excluded") return "failed";
  if (status === "possible" || status === "insufficient_evidence")
    return "needs_manual_review";
  return "pending";
}

function mapVerification(value: string): ContactRoute["verification"] {
  if (value === "source_confirmed") return "source_confirmed";
  if (value === "verified") return "source_confirmed";
  if (value === "unknown") return "unknown";
  return "unverified";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
