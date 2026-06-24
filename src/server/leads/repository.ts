import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import { leads as sampleLeads } from "@/data/mock/prospecting";
import type { EvaluatedLeadCandidate } from "@/lib/providers/lead-evaluator";
import type { SearchResult } from "@/lib/providers/tavily";
import type {
  Confidence,
  ContactRoute,
  DiscoveryProgress,
  EvidenceClaim,
  EvidenceKind,
  Lead,
  LeadQualificationStatus,
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
  qualification_error?: string | null;
  qualification_status?: LeadQualificationStatus;
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

type DiscoveredLeadInput = {
  campaignId: string;
  country: string;
  result: SearchResult;
};

export type SavedDiscoveredLead = {
  databaseId: string;
  externalId: string;
  result: SearchResult;
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

export async function updateLeadStatus(
  workspaceId: string,
  leadId: string,
  status: LeadStatus,
): Promise<Lead> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("workspace_id", workspaceId)
    .eq("external_id", leadId)
    .select(leadSelect)
    .single();

  if (error) {
    throw new Error(`Could not update lead: ${error.message}`);
  }

  return mapLead(data as LeadRow);
}

export async function getCampaignLeadCounts(
  workspaceId: string,
  campaignId: string,
): Promise<{ awaitingReview: number; total: number }> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select("status")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId);

  if (error) {
    throw new Error(`Could not count campaign leads: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ status: LeadStatus }>;

  return {
    awaitingReview: rows.filter((row) => row.status === "needs_review").length,
    total: rows.length,
  };
}

export async function getCampaignDiscoveryProgress(
  workspaceId: string,
  campaignId: string,
  desiredLeadCount: number,
): Promise<DiscoveryProgress> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        qualification_status,
        lead_contact_routes (
          value,
          verification
        )
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId);

  if (isMissingQualificationColumnError(error)) {
    const fallback = await supabase
      .from("leads")
      .select(
        `
          lead_contact_routes (
            value,
            verification
          )
        `,
      )
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", campaignId);

    if (fallback.error) {
      throw new Error(`Could not load discovery progress: ${fallback.error.message}`);
    }

    const fallbackRows = (fallback.data ?? []) as Array<{
      lead_contact_routes: Array<{ value: string; verification: string }> | null;
    }>;

    return {
      contactEnrichedCount: countRowsWithContactRoutes(fallbackRows),
      desiredLeadCount,
      leadCount: fallbackRows.length,
      qualificationAttemptedCount: 0,
      qualifiedCount: 0,
    };
  }

  if (error) {
    throw new Error(`Could not load discovery progress: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{
    lead_contact_routes: Array<{ value: string; verification: string }> | null;
    qualification_status?: LeadQualificationStatus | null;
  }>;

  return {
    contactEnrichedCount: countRowsWithContactRoutes(rows),
    desiredLeadCount,
    leadCount: rows.length,
    qualificationAttemptedCount: rows.filter(
      (row) => row.qualification_status && row.qualification_status !== "pending",
    ).length,
    qualifiedCount: rows.filter((row) => row.qualification_status === "qualified").length,
  };
}

export async function importRawDiscoveredLeads(
  workspaceId: string,
  inputs: DiscoveredLeadInput[],
): Promise<SavedDiscoveredLead[]> {
  if (inputs.length === 0) {
    return [];
  }

  const uniqueInputs = dedupeDiscoveredLeadInputs(inputs);
  const { supabase } = await createAuthenticatedDatabaseClient();
  const leadRows = uniqueInputs.map((input) => {
    const website = getOrigin(input.result.url);
    const externalId = createDiscoveredLeadId(input.result.url, input.result.title);

    return {
      campaign_id: input.campaignId,
      city: "Unknown",
      company: normalizeCompanyName(input.result.title),
      company_type: "Discovered company",
      confidence: "low" as const,
      contactability: "low" as const,
      country: input.country,
      description: input.result.content || input.result.title,
      estimated_size: "Unknown",
      external_id: externalId,
      fit_score: scoreToFit(input.result.score),
      industry: "Unqualified web discovery",
      status: "needs_review" as const,
      summary:
        input.result.content ||
        "Discovered from Tavily search. Needs manual review if AI qualification fails.",
      website,
      workspace_id: workspaceId,
    };
  });

  let { data, error } = await supabase
    .from("leads")
    .upsert(
      leadRows.map((row) => ({
        ...row,
        qualification_error: null,
        qualification_status: "pending" as const,
      })),
      { onConflict: "workspace_id,external_id" },
    )
    .select("id,external_id");

  if (isMissingQualificationColumnError(error)) {
    const fallbackResult = await supabase
      .from("leads")
      .upsert(leadRows, { onConflict: "workspace_id,external_id" })
      .select("id,external_id");

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Could not import discovered leads: ${error.message}`);
  }

  const persistedLeads = (data ?? []) as PersistedLeadIdentifier[];
  const leadIdByExternalId = new Map(
    persistedLeads.map((lead) => [lead.external_id, lead.id]),
  );
  const evidenceRows = uniqueInputs.flatMap((input, index) => {
    const externalId = createDiscoveredLeadId(input.result.url, input.result.title);
    const leadId = leadIdByExternalId.get(externalId);

    return leadId
      ? [
          {
            confidence: "medium" as const,
            external_id: `search-${index + 1}`,
            kind: "fact" as const,
            lead_id: leadId,
            retrieved_at: new Date().toISOString().slice(0, 10),
            sort_order: 0,
            source_label: input.result.title,
            source_type: "Tavily search result",
            source_url: input.result.url,
            text:
              input.result.content ||
              `Tavily returned ${input.result.title} for the campaign query.`,
          },
        ]
      : [];
  });

  if (evidenceRows.length > 0) {
    const { error: evidenceError } = await supabase
      .from("lead_evidence_claims")
      .upsert(evidenceRows, { onConflict: "lead_id,external_id" });

    if (evidenceError) {
      throw new Error(
        `Could not save discovered lead evidence: ${evidenceError.message}`,
      );
    }
  }

  return uniqueInputs.flatMap((input) => {
    const externalId = createDiscoveredLeadId(input.result.url, input.result.title);
    const databaseId = leadIdByExternalId.get(externalId);

    return databaseId
      ? [
          {
            databaseId,
            externalId,
            result: input.result,
          },
        ]
      : [];
  });
}

export async function applyLeadQualification(
  workspaceId: string,
  leadExternalId: string,
  candidate: EvaluatedLeadCandidate,
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  let { data, error } = await supabase
    .from("leads")
    .update({
      company: normalizeCompanyName(candidate.companyName),
      company_type: candidate.companyType,
      confidence: candidate.confidence,
      description: candidate.summary,
      fit_score: candidate.fitScore,
      industry: candidate.industry,
      qualification_error: null,
      qualification_status: "qualified",
      status: "needs_review",
      summary: candidate.summary,
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", leadExternalId)
    .select("id")
    .single();

  if (isMissingQualificationColumnError(error)) {
    const fallbackResult = await supabase
      .from("leads")
      .update({
        company: normalizeCompanyName(candidate.companyName),
        company_type: candidate.companyType,
        confidence: candidate.confidence,
        description: candidate.summary,
        fit_score: candidate.fitScore,
        industry: candidate.industry,
        status: "needs_review",
        summary: candidate.summary,
      })
      .eq("workspace_id", workspaceId)
      .eq("external_id", leadExternalId)
      .select("id")
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Could not update lead qualification: ${error.message}`);
  }

  const leadId = (data as { id: string }).id;
  await replaceLeadQualificationDimensions(
    leadId,
    buildQualifiedDimensions(candidate),
  );

  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    [
      {
        confidence: candidate.confidence,
        external_id: "ai-qualification",
        kind: "inference",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 1,
        source_label: "OpenRouter lead qualification",
        source_type: "AI lead qualification",
        source_url: candidate.result.url,
        text: candidate.reason,
      },
    ],
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(
      `Could not save lead qualification evidence: ${evidenceError.message}`,
    );
  }
}

export async function applyManualReviewQualification(
  workspaceId: string,
  leadExternalId: string,
  input: {
    companyType: string;
    fitScore: number;
    industry: string;
    reason: string;
    summary: string;
  },
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  let { data, error } = await supabase
    .from("leads")
    .update({
      company_type: input.companyType,
      confidence: "low",
      description: input.summary,
      fit_score: input.fitScore,
      industry: input.industry,
      qualification_error: input.reason,
      qualification_status: "non_ai_manual_review",
      status: "needs_review",
      summary: input.summary,
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", leadExternalId)
    .select("id")
    .single();

  if (isMissingQualificationColumnError(error)) {
    const fallbackResult = await supabase
      .from("leads")
      .update({
        company_type: input.companyType,
        confidence: "low",
        description: input.summary,
        fit_score: input.fitScore,
        industry: input.industry,
        status: "needs_review",
        summary: input.summary,
      })
      .eq("workspace_id", workspaceId)
      .eq("external_id", leadExternalId)
      .select("id")
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Could not update manual lead qualification: ${error.message}`);
  }

  const leadId = (data as { id: string }).id;
  await replaceLeadQualificationDimensions(
    leadId,
    buildManualReviewDimensions(input.fitScore, input.reason),
  );

  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    [
      {
        confidence: "low",
        external_id: "manual-review-qualification",
        kind: "inference",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 1,
        source_label: "Deterministic local fallback",
        source_type: "Non-AI manual-review qualification",
        source_url: "",
        text: input.reason,
      },
    ],
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(
      `Could not save manual qualification evidence: ${evidenceError.message}`,
    );
  }
}

export async function markLeadQualificationForManualReview(
  workspaceId: string,
  leadExternalId: string,
  errorMessage: string,
  qualificationStatus: Extract<
    LeadQualificationStatus,
    "failed" | "needs_manual_review" | "non_ai_manual_review"
  > = "needs_manual_review",
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  let { data, error } = await supabase
    .from("leads")
    .update({
      qualification_error: sanitizeQualificationError(errorMessage),
      qualification_status: qualificationStatus,
      status: "needs_review",
    })
    .eq("workspace_id", workspaceId)
    .eq("external_id", leadExternalId)
    .select("id")
    .single();

  if (isMissingQualificationColumnError(error)) {
    const fallbackResult = await supabase
      .from("leads")
      .update({
        status: "needs_review",
      })
      .eq("workspace_id", workspaceId)
      .eq("external_id", leadExternalId)
      .select("id")
      .single();

    data = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (error) {
    throw new Error(`Could not mark lead for manual review: ${error.message}`);
  }

  const leadId = (data as { id: string }).id;
  await replaceLeadQualificationDimensions(
    leadId,
    buildFailedQualificationDimensions(errorMessage),
  );

  const { error: evidenceError } = await supabase.from("lead_evidence_claims").upsert(
    [
      {
        confidence: "low",
        external_id: "qualification-error",
        kind: "unknown",
        lead_id: leadId,
        retrieved_at: new Date().toISOString().slice(0, 10),
        sort_order: 2,
        source_label: "OpenRouter lead qualification",
        source_type: "AI qualification failure",
        source_url: "",
        text: sanitizeQualificationError(errorMessage),
      },
    ],
    { onConflict: "lead_id,external_id" },
  );

  if (evidenceError) {
    throw new Error(
      `Could not save qualification failure evidence: ${evidenceError.message}`,
    );
  }
}

export async function replaceLeadContactRoutes(
  leadDatabaseId: string,
  routes: ContactRoute[],
): Promise<void> {
  if (routes.length === 0) {
    return;
  }

  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error: deleteError } = await supabase
    .from("lead_contact_routes")
    .delete()
    .eq("lead_id", leadDatabaseId);

  if (deleteError) {
    throw new Error(`Could not clear lead contact routes: ${deleteError.message}`);
  }

  const { error: insertError } = await supabase.from("lead_contact_routes").insert(
    routes.map((route, index) => ({
      lead_id: leadDatabaseId,
      sort_order: index,
      source: route.source,
      suggested_role: route.suggestedRole,
      type: route.type,
      value: route.value,
      verification: route.verification,
    })),
  );

  if (insertError) {
    throw new Error(`Could not save lead contact routes: ${insertError.message}`);
  }

  const confirmedRoutes = routes.filter(
    (route) => route.verification === "source_confirmed",
  ).length;
  const contactability: Confidence =
    confirmedRoutes >= 2 ? "high" : confirmedRoutes === 1 ? "medium" : "low";
  const { error: updateError } = await supabase
    .from("leads")
    .update({ contactability })
    .eq("id", leadDatabaseId);

  if (updateError) {
    throw new Error(`Could not update lead contactability: ${updateError.message}`);
  }
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
    qualificationError: row.qualification_error ?? "",
    qualificationStatus: row.qualification_status ?? "needs_manual_review",
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

function dedupeDiscoveredLeadInputs(inputs: DiscoveredLeadInput[]) {
  const inputByExternalId = new Map<string, DiscoveredLeadInput>();

  for (const input of inputs) {
    const externalId = createDiscoveredLeadId(input.result.url, input.result.title);
    const existing = inputByExternalId.get(externalId);

    if (!existing || getSearchScore(input.result) > getSearchScore(existing.result)) {
      inputByExternalId.set(externalId, input);
    }
  }

  return [...inputByExternalId.values()];
}

function createDiscoveredLeadId(url: string, title: string) {
  const source = getOrigin(url).replace(/^https?:\/\//, "") || title;
  return `web-${slugify(source)}`.slice(0, 80).replace(/-+$/g, "");
}

function normalizeCompanyName(companyName: string) {
  return companyName.trim().slice(0, 180) || "Unknown company";
}

function scoreToFit(score: number | null) {
  if (typeof score !== "number") {
    return 45;
  }

  return Math.max(35, Math.min(70, Math.round(score * 100)));
}

function getSearchScore(result: SearchResult) {
  return typeof result.score === "number" ? result.score : 0;
}

function sanitizeQualificationError(errorMessage: string) {
  return errorMessage.replace(/\s+/g, " ").trim().slice(0, 1000);
}

function buildQualifiedDimensions(candidate: EvaluatedLeadCandidate) {
  return [
    {
      confidence: candidate.confidence,
      explanation: candidate.reason,
      label: "Campaign fit",
      score: candidate.fitScore,
    },
    {
      confidence: "medium" as const,
      explanation:
        "Search result and saved source evidence support manual review, but full website research is still limited.",
      label: "Evidence quality",
      score: Math.max(45, Math.min(75, candidate.fitScore - 10)),
    },
    {
      confidence: "low" as const,
      explanation:
        "Contact discovery runs separately and may only find a website or general route.",
      label: "Contactability",
      score: 45,
    },
  ];
}

function buildManualReviewDimensions(fitScore: number, reason: string) {
  return [
    {
      confidence: "low" as const,
      explanation: reason,
      label: "Campaign fit",
      score: fitScore,
    },
    {
      confidence: "medium" as const,
      explanation:
        "The lead was saved from Tavily before AI qualification and should be manually reviewed.",
      label: "Evidence quality",
      score: 45,
    },
    {
      confidence: "low" as const,
      explanation:
        "Contact discovery may still provide a public website route even when no email is found.",
      label: "Contactability",
      score: 35,
    },
  ];
}

function buildFailedQualificationDimensions(errorMessage: string) {
  return buildManualReviewDimensions(
    35,
    `AI qualification failed: ${sanitizeQualificationError(errorMessage)}`,
  );
}

async function replaceLeadQualificationDimensions(
  leadId: string,
  dimensions: Array<{
    confidence: Confidence;
    explanation: string;
    label: string;
    score: number;
  }>,
) {
  await replaceLeadChildren(
    "lead_qualification_dimensions",
    [leadId],
    dimensions.map((dimension, index) => ({
      confidence: dimension.confidence,
      explanation: dimension.explanation,
      label: dimension.label,
      lead_id: leadId,
      score: dimension.score,
      sort_order: index,
    })),
  );
}

function isMissingQualificationColumnError(error: { message?: string } | null) {
  const message = error?.message ?? "";
  const mentionsQualificationColumn =
    message.includes("qualification_status") || message.includes("qualification_error");
  const isMissingColumn =
    message.includes("does not exist") ||
    message.includes("Could not find") ||
    message.includes("schema cache");

  return mentionsQualificationColumn && isMissingColumn;
}

function countRowsWithContactRoutes(
  rows: Array<{
    lead_contact_routes: Array<{ value: string; verification: string }> | null;
  }>,
) {
  return rows.filter((row) =>
    (row.lead_contact_routes ?? []).some(
      (route) => Boolean(route.value) && route.verification === "source_confirmed",
    ),
  ).length;
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
