"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  Campaign,
  CampaignStatus,
  ContactDiscoveryReport,
} from "@/types/domain";
import { discoverContactRoutes } from "@/lib/discovery/contact-extractor";
import { buildCampaignSearchQueries } from "@/lib/discovery/query-builder";
import {
  calculateDiscoveryProgress,
  buildDiscoveryReport,
} from "@/lib/discovery/report";
import {
  classifySearchResults,
} from "@/lib/discovery/result-classifier";
import { evaluateLeadCandidate } from "@/lib/providers/lead-evaluator";
import { searchWeb, type SearchResult } from "@/lib/providers/tavily";
import {
  applyManualReviewQualification,
  applyLeadQualification,
  getCampaignLeadCounts,
  importRawDiscoveredLeads,
  markLeadQualificationForManualReview,
  replaceLeadContactRoutes,
  type SavedDiscoveredLead,
} from "@/server/leads/repository";
import {
  createCampaign,
  getCampaign,
  importSampleCampaigns,
  updateCampaign,
  updateCampaignDiscoveryState,
  updateCampaignStatus,
} from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);

export async function discoverCampaignLeadsAction(campaignId: string) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  const campaign = await getCampaign(currentWorkspace.id, campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const existingLeadCounts = await getCampaignLeadCounts(currentWorkspace.id, campaign.id);
  const remainingLeadSlots = Math.max(
    campaign.desiredLeadCount - existingLeadCounts.total,
    0,
  );

  if (remainingLeadSlots === 0) {
    const report = buildDiscoveryReport({
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
    });

    await updateCampaignDiscoveryState(currentWorkspace.id, campaign.id, {
      awaitingReview: existingLeadCounts.awaitingReview,
      latestDiscoveryReport: report,
      leadCount: existingLeadCounts.total,
      progress: calculateDiscoveryProgress(
        existingLeadCounts.total,
        campaign.desiredLeadCount,
      ),
      status: "completed",
    });

    await createActivityEvent(currentWorkspace.id, {
      description: `${campaign.name} already has ${existingLeadCounts.total} lead source${existingLeadCounts.total === 1 ? "" : "s"}, meeting the target of ${campaign.desiredLeadCount}. Discovery did not save additional leads.`,
      entityExternalId: campaign.id,
      entityType: "campaign",
      label: "Campaign discovery skipped",
    });

    revalidatePath("/dashboard");
    revalidatePath("/leads");
    revalidatePath("/campaigns");
    revalidatePath(`/campaigns/${campaign.id}`);

    return {
      report,
      message: `Target already reached: ${existingLeadCounts.total} / ${campaign.desiredLeadCount} leads saved. Increase desired leads to discover more.`,
    };
  }

  const queries = buildCampaignSearchQueries(campaign);
  const searchReport = await searchCampaignWeb(queries);
  const acceptedResults = searchReport.acceptedResults.slice(0, remainingLeadSlots);
  const targetSkippedResults = searchReport.acceptedResults
    .slice(remainingLeadSlots)
    .map((result) => ({
      query: result.query,
      reason: `Campaign target reached after ${remainingLeadSlots} additional lead source${remainingLeadSlots === 1 ? "" : "s"}`,
      title: result.title,
      url: result.url,
    }));
  const savedLeads = await importRawDiscoveredLeads(
    currentWorkspace.id,
    acceptedResults.map((result) => ({
      campaignId: campaign.id,
      country: campaign.geography,
      result,
    })),
  );
  const qualification = await qualifySavedLeads(
    currentWorkspace.id,
    campaign,
    savedLeads,
  );
  const contacts = await discoverContactsForSavedLeads(savedLeads);
  const leadCounts = await getCampaignLeadCounts(currentWorkspace.id, campaign.id);
  const progress = calculateDiscoveryProgress(
    leadCounts.total,
    campaign.desiredLeadCount,
  );
  const report = buildDiscoveryReport({
    aiQualificationFailures: qualification.failures,
    aiQualificationSuccesses: qualification.successes,
    contactDiscovery: contacts.reports,
    contactRoutesFound: contacts.routeCount,
    duplicateResults: searchReport.duplicateResults,
    finalReviewableLeads: savedLeads.map((lead) => lead.externalId),
    leadsSavedBeforeAiQualification: savedLeads.map((lead) => lead.externalId),
    queriesExecuted: queries,
    rawTavilyResults: searchReport.rawResults,
    rejectedResults: searchReport.rejectedResults,
    targetSkippedResults,
  });

  await updateCampaignDiscoveryState(currentWorkspace.id, campaign.id, {
    awaitingReview: leadCounts.awaitingReview,
    latestDiscoveryReport: report,
    leadCount: leadCounts.total,
    progress,
    status:
      leadCounts.total >= campaign.desiredLeadCount && campaign.desiredLeadCount > 0
        ? "completed"
        : "running",
  });

  await createActivityEvent(currentWorkspace.id, {
    description: `${savedLeads.length} Tavily lead source${savedLeads.length === 1 ? "" : "s"} saved for ${campaign.name}. ${qualification.successes.length} AI-qualified, ${qualification.failures.length} need manual review. ${contacts.routeCount} contact route${contacts.routeCount === 1 ? "" : "s"} found. ${searchReport.duplicateResults.length} duplicate, ${searchReport.rejectedResults.length} rejected, and ${targetSkippedResults.length} target-capped result${targetSkippedResults.length === 1 ? "" : "s"} recorded.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign discovery run",
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);

  return {
    report,
    message: `${savedLeads.length} discovered lead source${savedLeads.length === 1 ? "" : "s"} saved toward the ${campaign.desiredLeadCount}-lead target. ${qualification.successes.length} AI-qualified, ${qualification.failures.length} need manual review. ${contacts.routeCount} contact route${contacts.routeCount === 1 ? "" : "s"} found.`,
  };
}

export async function updateCampaignStatusAction(input: UpdateCampaignStatusInput) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  if (!input.campaignId || !controlStatuses.has(input.status)) {
    throw new Error("Unsupported campaign status.");
  }

  await updateCampaignStatus(currentWorkspace.id, input.campaignId, input.status);
  await createActivityEvent(currentWorkspace.id, {
    description: `Campaign ${input.campaignId} moved to ${input.status}.`,
    entityExternalId: input.campaignId,
    entityType: "campaign",
    label: "Campaign status updated",
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${input.campaignId}`);
  revalidatePath("/dashboard");

  return {
    message:
      input.status === "running"
        ? "Campaign running"
        : input.status === "paused"
          ? "Campaign paused"
          : "Campaign completed",
  };
}

export async function createCampaignAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const name = getString(formData, "name");
  const offerId = getString(formData, "offerId");
  const geography = getString(formData, "geography");

  if (name.length < 2 || !offerId || geography.length < 2) {
    redirect(
      `/campaigns/new?error=${encodeURIComponent(
        "Enter a campaign name, selected offer, and target geography.",
      )}`,
    );
  }

  const campaign = await createCampaign(currentWorkspace.id, {
    desiredLeadCount: getPositiveNumber(formData, "desiredLeadCount", 25),
    exclusions: getList(formData, "exclusions"),
    geography,
    industryTerms: getList(formData, "industryTerms"),
    language: getString(formData, "language") || "English",
    localizedTerms: getList(formData, "localizedTerms"),
    name,
    objective: getString(formData, "objective") || "Direct buyers",
    offerId,
    qualificationCriteria: getList(formData, "qualificationCriteria"),
    sourceCategories: getList(formData, "sourceCategories"),
    targetSegments: getList(formData, "targetSegments"),
    terms: getList(formData, "terms"),
  });
  await createActivityEvent(currentWorkspace.id, {
    description: `${campaign.name} was created for ${campaign.geography}.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign created",
  });

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect(`/campaigns/${campaign.id}`);
}

export async function updateCampaignAction(formData: FormData) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  const campaignId = getString(formData, "campaignId");
  const name = getString(formData, "name");
  const offerId = getString(formData, "offerId");
  const geography = getString(formData, "geography");

  if (!campaignId || name.length < 2 || !offerId || geography.length < 2) {
    redirect(
      `/campaigns/${campaignId}/edit?error=${encodeURIComponent(
        "Enter a campaign name, selected offer, and target geography.",
      )}`,
    );
  }

  const campaign = await updateCampaign(currentWorkspace.id, {
    campaignId,
    desiredLeadCount: getPositiveNumber(formData, "desiredLeadCount", 25),
    exclusions: getList(formData, "exclusions"),
    geography,
    industryTerms: getList(formData, "industryTerms"),
    language: getString(formData, "language") || "English",
    localizedTerms: getList(formData, "localizedTerms"),
    name,
    objective: getString(formData, "objective") || "Direct buyers",
    offerId,
    qualificationCriteria: getList(formData, "qualificationCriteria"),
    sourceCategories: getList(formData, "sourceCategories"),
    targetSegments: getList(formData, "targetSegments"),
    terms: getList(formData, "terms"),
  });
  await createActivityEvent(currentWorkspace.id, {
    description: `${campaign.name} strategy was edited.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign strategy edited",
  });

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);
  revalidatePath("/dashboard");
  redirect(`/campaigns/${campaign.id}`);
}

export async function importSampleCampaignsAction() {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    redirect("/onboarding/workspace");
  }

  await importSampleCampaigns(currentWorkspace.id);

  revalidatePath("/campaigns");
  revalidatePath("/dashboard");
  redirect("/campaigns?message=sample-campaigns-imported");
}

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getList(formData: FormData, key: string) {
  return getString(formData, key)
    .split(/[\n,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getPositiveNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(getString(formData, key));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

async function searchCampaignWeb(queries: string[]) {
  const resultsByQuery = await Promise.all(
    queries.map(async (query) =>
      (await searchWeb(query)).map((result) => ({
        ...result,
        query,
      })),
    ),
  );

  return classifySearchResults(resultsByQuery.flat());
}

async function qualifySavedLeads(
  workspaceId: string,
  campaign: Campaign,
  savedLeads: SavedDiscoveredLead[],
) {
  const successes: string[] = [];
  const failures: Array<{ error: string; leadId: string }> = [];

  for (const lead of savedLeads) {
    await applyManualReviewQualification(
      workspaceId,
      lead.externalId,
      buildManualReviewQualification(
        lead.result,
        "Deterministic baseline qualification was created before AI enrichment.",
      ),
    );

    try {
      const candidate = await evaluateLeadCandidate(campaign, lead.result);

      if (!candidate) {
        const message =
          "AI did not qualify this Tavily result as a confident campaign match.";
        await applyManualReviewQualification(
          workspaceId,
          lead.externalId,
          buildManualReviewQualification(lead.result, message),
        );
        failures.push({ error: message, leadId: lead.externalId });
        continue;
      }

      await applyLeadQualification(workspaceId, lead.externalId, candidate);
      successes.push(lead.externalId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI lead qualification failed.";
      await markLeadQualificationForManualReview(
        workspaceId,
        lead.externalId,
        message,
        "failed",
      );
      failures.push({ error: message, leadId: lead.externalId });
    }
  }

  return { failures, successes };
}

async function discoverContactsForSavedLeads(savedLeads: SavedDiscoveredLead[]) {
  let routeCount = 0;
  const reports: ContactDiscoveryReport[] = [];
  const batchSize = 6;

  for (let index = 0; index < savedLeads.length; index += batchSize) {
    const batch = savedLeads.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (lead) => {
        const discovery = await discoverContactRoutes(lead.result);
        await replaceLeadContactRoutes(lead.databaseId, discovery.routes);

        return {
          discovery,
          lead,
        };
      }),
    );

    for (const { discovery, lead } of batchResults) {
      routeCount += discovery.report.routesFound;
      reports.push({
        ...discovery.report,
        leadId: lead.externalId,
      });
    }
  }

  return { reports, routeCount };
}

function buildManualReviewQualification(result: SearchResult, reason: string) {
  return {
    companyType: "Potential company (manual review)",
    fitScore: Math.max(35, Math.min(58, Math.round((result.score ?? 0.45) * 100))),
    industry: "Needs manual qualification",
    reason: `${reason} This fallback is deterministic, non-AI, and should be manually reviewed.`,
    summary:
      result.content ||
      `Discovered from Tavily result "${result.title}". Review the website before outreach.`,
  };
}
