import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfferType } from "../../types/domain.ts";
import { buildCampaignSearchQueries } from "../../lib/discovery/query-builder.ts";
import { classifySearchResults } from "../../lib/discovery/result-classifier.ts";
import type { ClassifiedSearchResult } from "../../lib/discovery/result-classifier.ts";
import { calculateDiscoveryProgress, buildDiscoveryReport } from "../../lib/discovery/report.ts";
import { searchWeb } from "../../lib/providers/tavily.ts";
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
  offer_external_id: string;
  strategy_criteria: string[];
  strategy_exclusions: string[];
  strategy_limitations: string[];
  strategy_localized_terms: string[];
  strategy_sources: string[];
  strategy_terms: string[];
  target_segments: string[];
};

type OfferRow = {
  buyer_types: string[];
  capabilities: string[];
  differentiators: string[];
  external_id: string;
  keywords: string[];
  limitations: string[];
  name: string;
  problems: string[];
  summary: string;
  type: string;
};

type SavedLeadSource = {
  id: string;
  url: string;
};

type ExistingLeadForContactTask = {
  external_id: string;
  id: string;
  lead_contact_routes: Array<{
    value: string;
    verification: string;
  }> | null;
  lead_evidence_claims: Array<{
    source_label: string;
    source_type: string;
    source_url: string;
    text: string;
  }> | null;
  website: string;
};

export async function processSearchWebTask(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
) {
  await updateRunStep(supabase, task.run_id, "Loading campaign", 5);
  const campaign = await loadCampaign(supabase, task);
  const offer = await loadOffer(supabase, task.workspace_id, campaign.offer_external_id);
  const existingCount = await countCampaignLeads(supabase, task);
  const desiredLeadCount = campaign.desired_lead_count ?? getPayloadDesiredLeadCount(task);
  const remainingLeadSlots = Math.max(desiredLeadCount - existingCount.total, 0);
  const existingContactTaskCount = await enqueueExistingLeadContactTasks(
    supabase,
    task,
    desiredLeadCount,
  );

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
      existingContactTaskCount,
      savedLeadCount: 0,
      skippedReason: "Campaign target already reached",
    };
  }

  await updateRunStep(supabase, task.run_id, "Searching Tavily", 15);
  const queries = buildCampaignSearchQueries(toCampaignLike(campaign, offer, desiredLeadCount));
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
  const savedSources = await saveLeadSources(supabase, task, [
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

  await updateRunStep(supabase, task.run_id, "Queueing lead evaluation", 70);
  const evaluationTaskCount = await enqueueLeadEvaluationTasks(
    supabase,
    task,
    acceptedResults,
    savedSources,
  );
  const latestCounts = await countCampaignLeads(supabase, task);
  const report = buildDiscoveryReport({
    aiQualificationFailures: [],
    aiQualificationSuccesses: [],
    contactDiscovery: [],
    contactRoutesFound: 0,
    duplicateResults: searchReport.duplicateResults,
    finalReviewableLeads: [],
    leadsSavedBeforeAiQualification: [],
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
    evaluationTaskCount,
    existingContactTaskCount,
    queryCount: queries.length,
    rejectedResultCount: searchReport.rejectedResults.length,
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
        offer_external_id,
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

async function loadOffer(
  supabase: SupabaseClient,
  workspaceId: string,
  offerExternalId: string,
) {
  const { data, error } = await supabase
    .from("offers")
    .select(
      `
        external_id,
        name,
        type,
        summary,
        problems,
        capabilities,
        buyer_types,
        differentiators,
        limitations,
        keywords
      `,
    )
    .eq("workspace_id", workspaceId)
    .eq("external_id", offerExternalId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load offer for search context: ${error.message}`);
  }

  return data ? (data as OfferRow) : null;
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
): Promise<SavedLeadSource[]> {
  if (sources.length === 0) {
    return [];
  }

  const uniqueSources = dedupeLeadSources(sources);
  const { data, error } = await supabase.from("lead_sources").upsert(
    uniqueSources.map((source) => ({
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
  ).select("id,url");

  if (error) {
    throw new Error(`Could not save lead sources: ${error.message}`);
  }

  return (data ?? []) as SavedLeadSource[];
}

function dedupeLeadSources(
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
  const byUrl = new Map<string, (typeof sources)[number]>();
  const rank = {
    accepted: 3,
    duplicate: 2,
    rejected: 1,
  } as const;

  for (const source of sources) {
    const key = normalizeUrlKey(source.result.url);
    const existing = byUrl.get(key);
    const sourceRank = rank[source.classification as keyof typeof rank] ?? 0;
    const existingRank = existing
      ? (rank[existing.classification as keyof typeof rank] ?? 0)
      : 0;

    if (
      !existing ||
      sourceRank > existingRank ||
      (sourceRank === existingRank &&
        (source.result.score ?? 0) > (existing.result.score ?? 0))
    ) {
      byUrl.set(key, source);
    }
  }

  return [...byUrl.values()];
}

async function enqueueLeadEvaluationTasks(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  results: ClassifiedSearchResult[],
  savedSources: SavedLeadSource[],
) {
  if (results.length === 0) {
    return 0;
  }

  const sourceIdByUrl = new Map(
    savedSources.map((source) => [normalizeUrlKey(source.url), source.id]),
  );
  const taskRows = dedupeResults(results).map((result) => ({
    campaign_id: task.campaign_id,
    max_attempts: 3,
    payload_json: {
      source: {
        classification: result.classification ?? null,
        content: result.content,
        query: result.query,
        score: result.score,
        sourceId: sourceIdByUrl.get(normalizeUrlKey(result.url)),
        title: result.title,
        url: result.url,
      },
    },
    run_id: task.run_id,
    status: "pending",
    task_type: "evaluate_lead",
    workspace_id: task.workspace_id,
  }));
  const { error } = await supabase.from("research_tasks").insert(taskRows);

  if (error) {
    throw new Error(`Could not enqueue lead evaluation tasks: ${error.message}`);
  }

  return taskRows.length;
}

async function enqueueExistingLeadContactTasks(
  supabase: SupabaseClient,
  task: ResearchTaskRow,
  desiredLeadCount: number,
) {
  const { data, error } = await supabase
    .from("leads")
    .select(
      `
        id,
        external_id,
        website,
        lead_contact_routes (
          value,
          verification
        ),
        lead_evidence_claims (
          source_label,
          source_type,
          source_url,
          text
        )
      `,
    )
    .eq("workspace_id", task.workspace_id)
    .eq("campaign_id", task.campaign_id)
    .limit(Math.max(desiredLeadCount, 1));

  if (error) {
    throw new Error(`Could not load existing leads for contact enrichment: ${error.message}`);
  }

  const taskRows = ((data ?? []) as ExistingLeadForContactTask[])
    .filter((lead) => (lead.lead_contact_routes ?? []).length === 0)
    .map((lead) => {
      const evidence = pickSourceEvidence(lead);

      return {
        campaign_id: task.campaign_id,
        max_attempts: 2,
        payload_json: {
          leadDatabaseId: lead.id,
          leadExternalId: lead.external_id,
          source: {
            content: evidence.text,
            query: "existing lead evidence",
            title: evidence.source_label,
            url: evidence.source_url || lead.website,
          },
          website: lead.website,
        },
        run_id: task.run_id,
        status: "pending",
        task_type: "enrich_contacts",
        workspace_id: task.workspace_id,
      };
    });

  if (taskRows.length === 0) {
    return 0;
  }

  const { error: insertError } = await supabase.from("research_tasks").insert(taskRows);

  if (insertError) {
    throw new Error(
      `Could not enqueue existing lead contact enrichment tasks: ${insertError.message}`,
    );
  }

  return taskRows.length;
}

function pickSourceEvidence(lead: ExistingLeadForContactTask) {
  const evidence = (lead.lead_evidence_claims ?? []).find((claim) =>
    /tavily|search|source/i.test(`${claim.source_type} ${claim.source_label}`),
  );

  return (
    evidence ??
    lead.lead_evidence_claims?.[0] ?? {
      source_label: lead.external_id,
      source_type: "Saved lead website",
      source_url: lead.website,
      text: lead.website,
    }
  );
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

function toCampaignLike(
  campaign: CampaignRow,
  offer: OfferRow | null,
  desiredLeadCount: number,
) {
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
    offer: offer
      ? {
          buyerTypes: offer.buyer_types,
          capabilities: offer.capabilities,
          differentiators: offer.differentiators,
          keywords: offer.keywords,
          limitations: offer.limitations,
          name: offer.name,
          problems: offer.problems,
          summary: offer.summary,
          type: toOfferType(offer.type),
        }
      : null,
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

function dedupeResults(results: ClassifiedSearchResult[]) {
  const byUrl = new Map<string, ClassifiedSearchResult>();

  for (const result of results) {
    const urlKey = normalizeUrlKey(result.url);
    const existing = byUrl.get(urlKey);

    if (!existing || (result.score ?? 0) > (existing.score ?? 0)) {
      byUrl.set(urlKey, result);
    }
  }

  return [...byUrl.values()];
}

function getPayloadDesiredLeadCount(task: ResearchTaskRow) {
  const value = Number(task.payload_json.desiredLeadCount);

  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 25;
}

function toOfferType(type: string): OfferType {
  return (
    type === "product" ||
    type === "service" ||
    type === "software" ||
    type === "distribution" ||
    type === "manufacturing" ||
    type === "partnership"
      ? type
      : "service"
  );
}

function normalizeUrlKey(url: string) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.toString().replace(/\/$/g, "").toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}
