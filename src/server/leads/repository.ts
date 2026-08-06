import { createHash } from "node:crypto";
import { createAuthenticatedDatabaseClient } from "@/lib/supabase/server";
import type { SearchResult } from "@/lib/providers/tavily";
import type {
  Confidence,
  ContactRoute,
  DiscoveryProgress,
  Lead,
  LeadQualificationStatus,
  LeadStatus,
} from "@/types/domain";

type EvaluatedLeadCandidate = {
  companyName: string;
  companyType: string;
  confidence: Confidence;
  fitScore: number;
  industry: string;
  reason: string;
  result: SearchResult;
  summary: string;
};
import {
  getCleanCampaignLeadCounts,
  getCleanLead,
  listCleanLeads,
  updateCleanLeadStatus,
} from "./clean-repository";

type PersistedLeadIdentifier = {
  campaignCompanyId: string;
  sourceUrl: string;
};

type DatabaseClient = Awaited<
  ReturnType<typeof createAuthenticatedDatabaseClient>
>["supabase"];

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

export async function listLeads(workspaceId: string): Promise<Lead[]> {
  return listCleanLeads(workspaceId);
}

export async function listCampaignLeads(
  workspaceId: string,
  campaignId: string,
): Promise<Lead[]> {
  return listCleanLeads(workspaceId, campaignId);
}

export async function getLead(workspaceId: string, leadId: string): Promise<Lead | null> {
  return getCleanLead(workspaceId, leadId);
}

export async function updateLeadStatus(
  workspaceId: string,
  leadId: string,
  status: LeadStatus,
): Promise<Lead> {
  return updateCleanLeadStatus(workspaceId, leadId, status);
}

export async function updateLeadNotes(
  workspaceId: string,
  leadId: string,
  userNotes: string,
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { error } = await supabase
    .from("campaign_companies")
    .update({ user_notes: userNotes.trim().slice(0, 5_000) })
    .eq("workspace_id", workspaceId)
    .eq("id", leadId);
  if (error) throw new Error(`Could not save lead notes: ${error.message}`);
}

export async function getCampaignLeadCounts(
  workspaceId: string,
  campaignId: string,
): Promise<{ awaitingReview: number; total: number }> {
  return getCleanCampaignLeadCounts(workspaceId, campaignId);
}

export async function getCampaignDiscoveryProgress(
  workspaceId: string,
  campaignId: string,
  desiredLeadCount: number,
): Promise<DiscoveryProgress> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", campaignId)
    .maybeSingle();
  if (campaignError)
    throw new Error(`Could not load discovery progress: ${campaignError.message}`);
  if (!campaign)
    return {
      contactEnrichedCount: 0,
      desiredLeadCount,
      leadCount: 0,
      qualificationAttemptedCount: 0,
      qualifiedCount: 0,
    };

  const { data, error } = await supabase
    .from("campaign_companies")
    .select(
      `
        qualification_results (status),
        campaign_contacts (id)
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaign.id);
  if (error) throw new Error(`Could not load discovery progress: ${error.message}`);

  const rows = (data ?? []) as unknown as Array<{
    campaign_contacts: Array<{ id: string }> | null;
    qualification_results: Array<{ status: string }> | null;
  }>;

  return {
    contactEnrichedCount: rows.filter((row) => (row.campaign_contacts ?? []).length > 0)
      .length,
    desiredLeadCount,
    leadCount: rows.length,
    qualificationAttemptedCount: rows.filter(
      (row) => (row.qualification_results ?? []).length > 0,
    ).length,
    qualifiedCount: rows.filter((row) =>
      (row.qualification_results ?? []).some((result) =>
        ["highly_relevant", "qualified"].includes(result.status),
      ),
    ).length,
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
  const campaignIds = [...new Set(uniqueInputs.map((input) => input.campaignId))];
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id,external_id")
    .eq("workspace_id", workspaceId)
    .in("external_id", campaignIds);
  if (campaignError)
    throw new Error(`Could not resolve discovery Campaigns: ${campaignError.message}`);
  const campaignByExternalId = new Map(
    (campaigns ?? []).map((campaign) => [campaign.external_id, campaign.id]),
  );

  const persisted: PersistedLeadIdentifier[] = [];
  for (const input of uniqueInputs) {
    const campaignDatabaseId = campaignByExternalId.get(input.campaignId);
    if (!campaignDatabaseId)
      throw new Error(`Campaign ${input.campaignId} was not found for discovery.`);
    const companyId = await findOrCreateCompany(supabase, workspaceId, input);
    const { data: campaignCompany, error: associationError } = await supabase
      .from("campaign_companies")
      .upsert(
        {
          workspace_id: workspaceId,
          campaign_id: campaignDatabaseId,
          company_id: companyId,
          status: "discovered",
          source_summary: input.result.content || input.result.title,
          metadata: { sourceScore: input.result.score },
        },
        { onConflict: "campaign_id,company_id" },
      )
      .select("id")
      .single();
    if (associationError)
      throw new Error(
        `Could not associate discovered company: ${associationError.message}`,
      );

    const { error: sourceError } = await supabase.from("company_sources").upsert(
      {
        workspace_id: workspaceId,
        company_id: companyId,
        provider: "tavily",
        source_type: "search_result",
        title: input.result.title,
        source_url: input.result.url,
        original_url: input.result.url,
        excerpt: input.result.content || input.result.title,
        raw_content: input.result.content || null,
        metadata: { score: input.result.score },
      },
      { onConflict: "workspace_id,provider,source_url" },
    );
    if (sourceError)
      throw new Error(`Could not save discovered company source: ${sourceError.message}`);

    persisted.push({
      campaignCompanyId: campaignCompany.id,
      sourceUrl: input.result.url,
    });
  }

  const persistedByUrl = new Map(
    persisted.map((row) => [normalizeUrl(row.sourceUrl), row.campaignCompanyId]),
  );
  return uniqueInputs.flatMap((input) => {
    const id = persistedByUrl.get(normalizeUrl(input.result.url));
    return id ? [{ databaseId: id, externalId: id, result: input.result }] : [];
  });
}

async function findOrCreateCompany(
  supabase: Awaited<ReturnType<typeof createAuthenticatedDatabaseClient>>["supabase"],
  workspaceId: string,
  input: DiscoveredLeadInput,
) {
  const website = getOrigin(input.result.url);
  const domain = normalizedDomain(website);
  if (domain) {
    const { data: existingDomain, error: domainError } = await supabase
      .from("company_domains")
      .select("company_id")
      .eq("workspace_id", workspaceId)
      .eq("normalized_domain", domain)
      .maybeSingle();
    if (domainError)
      throw new Error(`Could not resolve company domain: ${domainError.message}`);
    if (existingDomain) return existingDomain.company_id;
  }

  const name = normalizeCompanyName(input.result.title);
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      workspace_id: workspaceId,
      name,
      normalized_name: normalizeCompanyKey(name),
      website_url: website,
      country: input.country || null,
      description: input.result.content || input.result.title,
      metadata: { discoveredBy: "tavily" },
    })
    .select("id")
    .single();
  if (companyError)
    throw new Error(`Could not save discovered company: ${companyError.message}`);

  if (domain) {
    const { error: domainInsertError } = await supabase.from("company_domains").insert({
      workspace_id: workspaceId,
      company_id: company.id,
      domain,
      normalized_domain: domain,
      is_primary: true,
      verification_status: "source_confirmed",
      metadata: { sourceUrl: input.result.url },
    });
    if (domainInsertError)
      throw new Error(
        `Could not save discovered company domain: ${domainInsertError.message}`,
      );
  }
  return company.id;
}

export async function applyLeadQualification(
  workspaceId: string,
  campaignCompanyId: string,
  candidate: EvaluatedLeadCandidate,
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  const association = await loadCampaignCompanyForQualification(
    supabase,
    workspaceId,
    campaignCompanyId,
  );
  const { error: companyError } = await supabase
    .from("companies")
    .update({
      name: normalizeCompanyName(candidate.companyName),
      normalized_name: normalizeCompanyKey(candidate.companyName),
      company_type: candidate.companyType,
      description: candidate.summary,
      industry: candidate.industry,
      website_url: getOrigin(candidate.result.url),
    })
    .eq("workspace_id", workspaceId)
    .eq("id", association.company_id);
  if (companyError)
    throw new Error(`Could not update qualified company: ${companyError.message}`);

  await persistCleanQualification(supabase, {
    workspaceId,
    campaignCompanyId,
    status:
      candidate.fitScore >= 80
        ? "highly_relevant"
        : candidate.fitScore >= 60
          ? "qualified"
          : "possible",
    score: candidate.fitScore,
    confidence: candidate.confidence,
    summary: candidate.summary,
    relationshipHypothesis: candidate.reason,
    positiveSignals: [candidate.reason],
    negativeSignals: [],
    missingEvidence: [],
    dimensions: buildQualifiedDimensions(candidate),
    evidence: [
      {
        criterion: "Campaign fit",
        evidenceKind: "inference",
        statement: candidate.reason,
        sourceUrl: candidate.result.url,
        confidence: candidate.confidence,
        metadata: {
          source_label: candidate.result.title,
          source_type: "AI lead qualification",
        },
      },
    ],
    input: candidate,
  });
  await updateCampaignCompanyQualificationState(
    supabase,
    workspaceId,
    campaignCompanyId,
    null,
  );
}

export async function applyManualReviewQualification(
  workspaceId: string,
  campaignCompanyId: string,
  input: {
    companyType: string;
    fitScore: number;
    industry: string;
    reason: string;
    summary: string;
  },
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  await loadCampaignCompanyForQualification(supabase, workspaceId, campaignCompanyId);
  await persistCleanQualification(supabase, {
    workspaceId,
    campaignCompanyId,
    status: "insufficient_evidence",
    score: input.fitScore,
    confidence: "low",
    summary: input.summary,
    relationshipHypothesis: input.reason,
    positiveSignals: [],
    negativeSignals: [],
    missingEvidence: [input.reason],
    dimensions: buildManualReviewDimensions(input.fitScore, input.reason),
    evidence: [
      {
        criterion: "Campaign fit",
        evidenceKind: "inference",
        statement: input.reason,
        sourceUrl: null,
        confidence: "low",
        metadata: { source_type: "manual_review" },
      },
    ],
    input,
  });
  await updateCampaignCompanyQualificationState(
    supabase,
    workspaceId,
    campaignCompanyId,
    input.reason,
  );
}

export async function markLeadQualificationForManualReview(
  workspaceId: string,
  campaignCompanyId: string,
  errorMessage: string,
  qualificationStatus: Extract<
    LeadQualificationStatus,
    "failed" | "needs_manual_review" | "non_ai_manual_review"
  > = "needs_manual_review",
): Promise<void> {
  const { supabase } = await createAuthenticatedDatabaseClient();
  void qualificationStatus;
  const message = sanitizeQualificationError(errorMessage);
  await loadCampaignCompanyForQualification(supabase, workspaceId, campaignCompanyId);
  await persistCleanQualification(supabase, {
    workspaceId,
    campaignCompanyId,
    status: "insufficient_evidence",
    score: 35,
    confidence: "low",
    summary: "Qualification requires manual review.",
    relationshipHypothesis: "",
    positiveSignals: [],
    negativeSignals: [],
    missingEvidence: [message],
    dimensions: buildFailedQualificationDimensions(message),
    evidence: [
      {
        criterion: "Evidence quality",
        evidenceKind: "unknown",
        statement: `AI qualification failed: ${message}`,
        sourceUrl: null,
        confidence: "low",
        metadata: { source_type: "ai_qualification_failure" },
      },
    ],
    input: { errorMessage: message },
  });
  await updateCampaignCompanyQualificationState(
    supabase,
    workspaceId,
    campaignCompanyId,
    message,
  );
}

export async function replaceLeadContactRoutes(
  campaignCompanyId: string,
  routes: ContactRoute[],
): Promise<void> {
  if (routes.length === 0) return;
  const { supabase } = await createAuthenticatedDatabaseClient();
  const { data: association, error: associationError } = await supabase
    .from("campaign_companies")
    .select("id,workspace_id,company_id")
    .eq("id", campaignCompanyId)
    .single();
  if (associationError)
    throw new Error(
      `Could not load company contact context: ${associationError.message}`,
    );

  for (const route of routes) {
    const methodType = cleanContactMethodType(route.type);
    const normalizedValue = normalizeContactValue(methodType, route.value);
    const { data: existingMethod, error: existingError } = await supabase
      .from("contact_methods")
      .select("id,company_id")
      .eq("workspace_id", association.workspace_id)
      .eq("method_type", methodType)
      .eq("normalized_value", normalizedValue)
      .maybeSingle();
    if (existingError)
      throw new Error(`Could not resolve contact method: ${existingError.message}`);
    if (existingMethod && existingMethod.company_id !== association.company_id)
      throw new Error("Contact method is already associated with another company.");

    let contactMethodId = existingMethod?.id;
    if (!contactMethodId) {
      const { data: created, error } = await supabase
        .from("contact_methods")
        .insert({
          workspace_id: association.workspace_id,
          company_id: association.company_id,
          method_type: methodType,
          value: route.value.trim(),
          normalized_value: normalizedValue,
          verification_status: cleanVerification(route.verification),
          metadata: { source: route.source },
        })
        .select("id")
        .single();
      if (error) throw new Error(`Could not save contact method: ${error.message}`);
      contactMethodId = created.id;
    }

    const provenance = route.verificationProvenance;
    if (provenance) {
      const { data: existingSource, error: sourceLookupError } = await supabase
        .from("contact_sources")
        .select("id")
        .eq("workspace_id", association.workspace_id)
        .eq("contact_method_id", contactMethodId)
        .eq("provider", provenance.provider)
        .eq("source_url", provenance.sourceUrl)
        .maybeSingle();
      if (sourceLookupError)
        throw new Error(`Could not resolve contact source: ${sourceLookupError.message}`);
      if (!existingSource) {
        const { error } = await supabase.from("contact_sources").insert({
          workspace_id: association.workspace_id,
          contact_method_id: contactMethodId,
          provider: provenance.provider,
          query: provenance.query,
          source_title: provenance.sourceTitle,
          source_url: provenance.sourceUrl,
          retrieved_at: provenance.verifiedAt,
        });
        if (error) throw new Error(`Could not save contact source: ${error.message}`);
      }
    }

    const { data: campaignContact, error: campaignContactError } = await supabase
      .from("campaign_contacts")
      .select("id")
      .eq("workspace_id", association.workspace_id)
      .eq("campaign_company_id", campaignCompanyId)
      .eq("contact_method_id", contactMethodId)
      .maybeSingle();
    if (campaignContactError)
      throw new Error(
        `Could not resolve Campaign contact: ${campaignContactError.message}`,
      );
    if (!campaignContact) {
      const { error } = await supabase.from("campaign_contacts").insert({
        workspace_id: association.workspace_id,
        campaign_company_id: campaignCompanyId,
        contact_method_id: contactMethodId,
        role_relevance: route.suggestedRole,
        selection_status: "candidate",
        recommendation_reason: route.source,
      });
      if (error) throw new Error(`Could not save Campaign contact: ${error.message}`);
    }
  }
}

function cleanContactMethodType(
  value: string,
):
  | "email"
  | "phone"
  | "linkedin_url"
  | "contact_form"
  | "general_company_email"
  | "website" {
  const normalized = value.trim().toLowerCase().replaceAll("-", "_");
  if (normalized === "phone") return "phone";
  if (normalized.includes("linkedin")) return "linkedin_url";
  if (normalized.includes("form")) return "contact_form";
  if (normalized.includes("general") || normalized.includes("company_email"))
    return "general_company_email";
  if (normalized === "website" || normalized === "url") return "website";
  return "email";
}

function normalizeContactValue(methodType: string, value: string) {
  const trimmed = value.trim();
  if (methodType === "email" || methodType === "general_company_email")
    return trimmed.toLowerCase();
  if (methodType === "phone") return trimmed.replace(/[^\d+]/g, "");
  return normalizeUrl(trimmed);
}

function cleanVerification(value: ContactRoute["verification"]) {
  if (value === "source_confirmed") return "source_confirmed" as const;
  if (value === "unknown") return "unknown" as const;
  return "unverified" as const;
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

function normalizeCompanyKey(companyName: string) {
  return companyName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizedDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function getSearchScore(result: SearchResult) {
  return typeof result.score === "number" ? result.score : 0;
}

function sanitizeQualificationError(errorMessage: string) {
  return errorMessage.replace(/\s+/g, " ").trim().slice(0, 1000);
}

async function loadCampaignCompanyForQualification(
  supabase: DatabaseClient,
  workspaceId: string,
  campaignCompanyId: string,
) {
  const { data, error } = await supabase
    .from("campaign_companies")
    .select("id,company_id,metadata")
    .eq("workspace_id", workspaceId)
    .eq("id", campaignCompanyId)
    .single();
  if (error)
    throw new Error(`Could not load company for qualification: ${error.message}`);
  return data;
}

async function persistCleanQualification(
  supabase: DatabaseClient,
  input: {
    workspaceId: string;
    campaignCompanyId: string;
    status:
      | "highly_relevant"
      | "qualified"
      | "possible"
      | "insufficient_evidence"
      | "not_relevant"
      | "excluded";
    score: number;
    confidence: Confidence;
    summary: string;
    relationshipHypothesis: string;
    positiveSignals: string[];
    negativeSignals: string[];
    missingEvidence: string[];
    dimensions: Array<{
      confidence: Confidence;
      explanation: string;
      label: string;
      score: number;
    }>;
    evidence: Array<{
      confidence: Confidence;
      criterion: string;
      evidenceKind: "fact" | "inference" | "unknown" | "conflict";
      metadata: Record<string, unknown>;
      sourceUrl: string | null;
      statement: string;
    }>;
    input: unknown;
  },
) {
  const inputHash = createHash("sha256")
    .update(JSON.stringify(input.input))
    .digest("hex");
  const { data: existing, error: existingError } = await supabase
    .from("qualification_results")
    .select("id")
    .eq("workspace_id", input.workspaceId)
    .eq("campaign_company_id", input.campaignCompanyId)
    .eq("input_hash", inputHash)
    .maybeSingle();
  if (existingError)
    throw new Error(
      `Could not check qualification idempotency: ${existingError.message}`,
    );
  if (existing) return existing.id;

  const { data: result, error: resultError } = await supabase
    .from("qualification_results")
    .insert({
      workspace_id: input.workspaceId,
      campaign_company_id: input.campaignCompanyId,
      status: input.status,
      score: Math.max(0, Math.min(100, Math.round(input.score))),
      confidence: input.confidence,
      summary: input.summary,
      relationship_hypothesis: input.relationshipHypothesis,
      recommended_roles: [],
      positive_signals: input.positiveSignals,
      negative_signals: input.negativeSignals,
      missing_evidence: input.missingEvidence,
      schema_version: "company-qualification-v1",
      prompt_version: "lead-evaluator-v1",
      input_hash: inputHash,
    })
    .select("id")
    .single();
  if (resultError)
    throw new Error(`Could not save qualification result: ${resultError.message}`);

  if (input.dimensions.length) {
    const { error } = await supabase.from("qualification_dimensions").insert(
      input.dimensions.map((dimension) => ({
        workspace_id: input.workspaceId,
        qualification_result_id: result.id,
        criterion: dimension.label,
        score: Math.max(0, Math.min(100, Math.round(dimension.score))),
        confidence: dimension.confidence,
        explanation: dimension.explanation,
      })),
    );
    if (error)
      throw new Error(`Could not save qualification dimensions: ${error.message}`);
  }

  if (input.evidence.length) {
    const { error } = await supabase.from("qualification_evidence").insert(
      input.evidence.map((evidence) => ({
        workspace_id: input.workspaceId,
        qualification_result_id: result.id,
        criterion: evidence.criterion,
        evidence_kind: evidence.evidenceKind,
        statement: evidence.statement,
        source_url: evidence.sourceUrl,
        confidence: evidence.confidence,
        metadata: evidence.metadata,
      })),
    );
    if (error) throw new Error(`Could not save qualification evidence: ${error.message}`);
  }
  return result.id;
}

async function updateCampaignCompanyQualificationState(
  supabase: DatabaseClient,
  workspaceId: string,
  campaignCompanyId: string,
  qualificationError: string | null,
) {
  const association = await loadCampaignCompanyForQualification(
    supabase,
    workspaceId,
    campaignCompanyId,
  );
  const metadata =
    association.metadata &&
    typeof association.metadata === "object" &&
    !Array.isArray(association.metadata)
      ? association.metadata
      : {};
  const { error } = await supabase
    .from("campaign_companies")
    .update({
      status: "needs_review",
      last_evaluated_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        ...(qualificationError
          ? { qualification_error: qualificationError }
          : { qualification_error: null }),
      },
    })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignCompanyId);
  if (error)
    throw new Error(`Could not update company qualification state: ${error.message}`);
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
