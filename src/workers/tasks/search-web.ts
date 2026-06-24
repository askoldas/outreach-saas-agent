import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCampaignSearchQueries } from "../../lib/discovery/query-builder.ts";
import { classifySearchResults } from "../../lib/discovery/result-classifier.ts";
import { calculateDiscoveryProgress, buildDiscoveryReport } from "../../lib/discovery/report.ts";
import { searchWeb, type SearchResult } from "../../lib/providers/tavily.ts";
import { updateRunStep } from "../lib/task-status.ts";
import type { ResearchTaskRow } from "../lib/claim-task.ts";

type CampaignRow = {
  awaiting_review: number;
  desired_lead_count?: number;
  external_id: string;
  geography: string;
  industry_terms?: string[] | null;
  language: string;
  name: string;
  objective: string;
  strategy_criteria: string[];
  strategy_exclusions: string[];
  strategy_limitations: string[];
  strategy_localized_terms: string[];
  strategy_sources: string[];
  strategy_terms: string[];
  target_segments: string[];
};

type SavedLead = {
  databaseId: string;
  externalId: string;
  result: SearchResult & { query: string };
};

export async function processSearchWebTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Loading campaign", 5);
  const campaign = await loadCampaign(supabase, task);
  const existingCount = await countCampaignLeads(supabase, task);
  const desiredLeadCount = campaign.desired_lead_count ?? getPayloadDesiredLeadCount(task);
  const remainingLeadSlots = Math.max(desiredLeadCount - existingCount.total, 0);

  if (remainingLeadSlots === 0) {
    await finishCampaignRun(supabase, task, campaign, {
      awaitingReview: existingCount.awaitingReview,
      leadCount: existingCount.total,
      report: buildDiscoveryReport({
        aiQualificationFailures: [],
        aiQualificationSuccesses: [],
        contactDiscovery: [],
        contactRoutesFound: 0,
        duplicateResults: [],
        finalReviewableLeads: [],
        leadsSavedBeforeAiQualification: [],
        queriesExecuted: [],
        rawTavilyResults: [],
        rejectedResults: [],
        targetSkippedResults: [],
      }),
    });

    return {
      existingLeadCount: existingCount.total,
      savedLeadCount: 0,
      skippedReason: "Campaign target already reached",
    };
  }

  await updateRunStep(supabase, task.run_id, "Searching Tavily", 15);
  const queries = buildCampaignSearchQueries(toCampaignLike(campaign, desiredLeadCount));
  const resultsByQuery = await Promise.all(
    queries.map(async (query) =>
      (await searchWeb(query)).map((result) => ({
        ...result,
        query,
      })),
    ),
  );
  const searchReport = classifySearchResults(resultsByQuery.flat());

  await updateRunStep(supabase, task.run_id, "Saving lead sources", 45);
  await saveLeadSources(supabase, task, [
    ...searchReport.acceptedResults.map((result) => ({
      classification: "accepted",
      rejectionReason: "",
      result,
    })),
    ...searchReport.duplicateResults.map((result) => ({
      classification: "duplicate",
      rejectionReason: result.reason,
      result,
    })),
    ...searchReport.rejectedResults.map((result) => ({
      classification: "rejected",
      rejectionReason: result.reason,
      result,
    })),
  ]);

  const acceptedResults = searchReport.acceptedResults.slice(0, remainingLeadSlots);
  const targetSkippedResults = searchReport.acceptedResults
    .slice(remainingLeadSlots)
    .map((result) => ({
      query: result.query,
      reason: `Campaign target reached after ${remainingLeadSlots} additional lead source${remainingLeadSlots === 1 ? "" : "s"}`,
      title: result.title,
      url: result.url,
    }));

  await updateRunStep(supabase, task.run_id, "Saving leads", 70);
  const savedLeads = await saveDiscoveredLeads(supabase, task, campaign, acceptedResults);
  const latestCounts = await countCampaignLeads(supabase, task);
  const report = buildDiscoveryReport({
    aiQualificationFailures: savedLeads.map((lead) => ({
      error: "AI qualification is queued for a future worker task. Baseline qualification was saved.",
      leadId: lead.externalId,
    })),
    aiQualificationSuccesses: [],
    contactDiscovery: [],
    contactRoutesFound: 0,
    duplicateResults: searchReport.duplicateResults,
    finalReviewableLeads: savedLeads.map((lead) => lead.externalId),
    leadsSavedBeforeAiQualification: savedLeads.map((lead) => lead.externalId),
    queriesExecuted: queries,
    rawTavilyResults: searchReport.rawResults,
    rejectedResults: searchReport.rejectedResults,
    targetSkippedResults,
  });

  await updateRunStep(supabase, task.run_id, "Updating campaign", 90);
  await finishCampaignRun(supabase, task, campaign, {
    awaitingReview: latestCounts.awaitingReview,
    leadCount: latestCounts.total,
    report,
  });

  return {
    acceptedResultCount: searchReport.acceptedResults.length,
    duplicateResultCount: searchReport.duplicateResults.length,
    queryCount: queries.length,
    rejectedResultCount: searchReport.rejectedResults.length,
    savedLeadCount: savedLeads.length,
    targetSkippedCount: targetSkippedResults.length,
  };
}

async function loadCampaign(supabase: SupabaseClient, task: ResearchTaskRow) {
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      `
        external_id,
        name,
        objective,
        geography,
        target_segments,
        language,
        strategy_terms,
        strategy_localized_terms,
        strategy_sources,
        strategy_criteria,
        strategy_exclusions,
        strategy_limitations,
        desired_lead_count,
        industry_terms,
        awaiting_review
      `,
    )
    .eq("workspace_id", task.workspace_id)
    .eq("external_id", task.campaign_id)
    .single();

  if (error) {
    throw new Error(`Could not load campaign ${task.campaign_id}: ${error.message}`);
  }

  return data as CampaignRow;
}

async function countCampaignLeads(supabase: SupabaseClient, task: ResearchTaskRow) {
  const { data, error } = await supabase
    .from("leads")
    .select("status")
    .eq("workspace_id", task.workspace_id)
    .eq("campaign_id", task.campaign_id);

  if (error) {
    throw new Error(`Could not count campaign leads: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ status: string }>;

  return {
    awaitingReview: rows.filter((row) => row.status === "needs_review").length,
    total: rows.length,
  };
}

async function saveLeadSources(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  sources: Array<{
    classification: string;
    rejectionReason: string;
    result: {
      content?: string;
      query: string;
      score?: number | null;
      title: string;
      url: string;
    };
  }>,
) {
  if (sources.length === 0) {
    return;
  }

  const { error } = await supabase.from("lead_sources").upsert(
    sources.map((source) => ({
      campaign_id: task.campaign_id,
      classification: source.classification,
      content: source.result.content ?? "",
      query: source.result.query,
      rejection_reason: source.rejectionReason || null,
      result_json: source.result,
      run_id: task.run_id,
      score: source.result.score,
      source_type: "tavily_search",
      title: source.result.title,
      url: source.result.url,
      workspace_id: task.workspace_id,
    })),
    { onConflict: "workspace_id,campaign_id,url" },
  );

  if (error) {
    throw new Error(`Could not save lead sources: ${error.message}`);
  }
}

async function saveDiscoveredLeads(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  campaign: CampaignRow,
  results: Array<SearchResult & { query: string }>,
): Promise<SavedLead[]> {
  if (results.length === 0) {
    return [];
  }

  const uniqueResults = dedupeResults(results);
  const leadRows = uniqueResults.map((result) => ({
    campaign_id: task.campaign_id,
    city: "Unknown",
    company: normalizeCompanyName(result.title),
    company_type: "Discovered company",
    confidence: "low",
    contactability: "low",
    country: campaign.geography,
    description: result.content || result.title,
    estimated_size: "Unknown",
    external_id: createDiscoveredLeadId(result.url, result.title),
    fit_score: scoreToFit(result.score),
    industry: "Baseline web discovery",
    qualification_error: "AI qualification is queued for a future worker task.",
    qualification_status: "non_ai_manual_review",
    status: "needs_review",
    summary:
      result.content ||
      `Discovered from Tavily result "${result.title}". Review the website before outreach.`,
    website: getOrigin(result.url),
    workspace_id: task.workspace_id,
  }));

  const { data, error } = await supabase
    .from("leads")
    .upsert(leadRows, { onConflict: "workspace_id,external_id" })
    .select("id,external_id");

  if (error) {
    throw new Error(`Could not save discovered leads: ${error.message}`);
  }

  const persisted = (data ?? []) as Array<{ external_id: string; id: string }>;
  const idByExternalId = new Map(persisted.map((lead) => [lead.external_id, lead.id]));
  const savedLeads = uniqueResults.flatMap((result) => {
    const externalId = createDiscoveredLeadId(result.url, result.title);
    const databaseId = idByExternalId.get(externalId);

    return databaseId ? [{ databaseId, externalId, result }] : [];
  });

  await saveEvidenceAndQualification(supabase, savedLeads);

  return savedLeads;
}

async function saveEvidenceAndQualification(
  supabase: SupabaseClient,
  savedLeads: SavedLead[],
) {
  if (savedLeads.length === 0) {
    return;
  }

  const evidenceRows = savedLeads.map((lead, index) => ({
    confidence: "medium",
    external_id: "search-web-worker",
    kind: "fact",
    lead_id: lead.databaseId,
    retrieved_at: new Date().toISOString().slice(0, 10),
    sort_order: index,
    source_label: lead.result.title,
    source_type: "Tavily search result",
    source_url: lead.result.url,
    text:
      lead.result.content ||
      `Tavily returned ${lead.result.title} for campaign query ${lead.result.query}.`,
  }));
  const dimensionRows = savedLeads.flatMap((lead) =>
    [
      {
        confidence: "low",
        explanation:
          "Saved from deterministic Tavily discovery. AI qualification is handled by a later worker task.",
        label: "Campaign fit",
        score: scoreToFit(lead.result.score),
      },
      {
        confidence: "medium",
        explanation: "The lead has a stored public search-result source.",
        label: "Evidence quality",
        score: 45,
      },
      {
        confidence: "low",
        explanation: "Contact discovery has not run yet.",
        label: "Contactability",
        score: 20,
      },
    ].map((dimension, index) => ({
      ...dimension,
      lead_id: lead.databaseId,
      sort_order: index,
    })),
  );

  const { error: evidenceError } = await supabase
    .from("lead_evidence_claims")
    .upsert(evidenceRows, { onConflict: "lead_id,external_id" });

  if (evidenceError) {
    throw new Error(`Could not save lead evidence: ${evidenceError.message}`);
  }

  const { error: deleteError } = await supabase
    .from("lead_qualification_dimensions")
    .delete()
    .in(
      "lead_id",
      savedLeads.map((lead) => lead.databaseId),
    );

  if (deleteError) {
    throw new Error(`Could not refresh lead qualification: ${deleteError.message}`);
  }

  const { error: dimensionError } = await supabase
    .from("lead_qualification_dimensions")
    .insert(dimensionRows);

  if (dimensionError) {
    throw new Error(`Could not save lead qualification: ${dimensionError.message}`);
  }
}

async function finishCampaignRun(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  campaign: CampaignRow,
  input: {
    awaitingReview: number;
    leadCount: number;
    report: unknown;
  },
) {
  const desiredLeadCount = campaign.desired_lead_count ?? getPayloadDesiredLeadCount(task);
  const { error } = await supabase
    .from("campaigns")
    .update({
      awaiting_review: input.awaitingReview,
      last_activity_label: "Just now",
      latest_discovery_report: input.report,
      lead_count: input.leadCount,
      progress: calculateDiscoveryProgress(input.leadCount, desiredLeadCount),
      status:
        input.leadCount >= desiredLeadCount && desiredLeadCount > 0
          ? "completed"
          : "running",
    })
    .eq("workspace_id", task.workspace_id)
    .eq("external_id", task.campaign_id);

  if (error) {
    throw new Error(`Could not update campaign discovery state: ${error.message}`);
  }
}

function toCampaignLike(campaign: CampaignRow, desiredLeadCount: number) {
  return {
    awaitingReview: campaign.awaiting_review,
    desiredLeadCount,
    geography: campaign.geography,
    id: campaign.external_id,
    industryTerms: campaign.industry_terms ?? [],
    language: campaign.language,
    lastActivity: "",
    latestDiscoveryReport: null,
    leadCount: 0,
    name: campaign.name,
    objective: campaign.objective,
    offerId: "",
    progress: 0,
    status: "running" as const,
    strategy: {
      criteria: campaign.strategy_criteria,
      exclusions: campaign.strategy_exclusions,
      limitations: campaign.strategy_limitations,
      localizedTerms: campaign.strategy_localized_terms,
      sources: campaign.strategy_sources,
      terms: campaign.strategy_terms,
    },
    targetSegments: campaign.target_segments,
    warnings: [],
  };
}

function dedupeResults(results: Array<SearchResult & { query: string }>) {
  const byExternalId = new Map<string, SearchResult & { query: string }>();

  for (const result of results) {
    const externalId = createDiscoveredLeadId(result.url, result.title);
    const existing = byExternalId.get(externalId);

    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      byExternalId.set(externalId, result);
    }
  }

  return [...byExternalId.values()];
}

function createDiscoveredLeadId(url: string, title: string) {
  const source = getOrigin(url).replace(/^https?:\/\//, "") || title;
  return `web-${slugify(source)}`.slice(0, 80).replace(/-+$/g, "");
}

function getPayloadDesiredLeadCount(task: ResearchTaskRow) {
  const value = Number(task.payload_json.desiredLeadCount);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 25;
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function normalizeCompanyName(companyName: string) {
  return companyName.trim().slice(0, 180) || "Unknown company";
}

function scoreToFit(score: number | null | undefined) {
  if (typeof score !== "number") {
    return 45;
  }

  return Math.max(35, Math.min(70, Math.round(score * 100)));
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
