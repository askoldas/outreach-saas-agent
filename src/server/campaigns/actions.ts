"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Campaign, CampaignStatus } from "@/types/domain";
import { evaluateLeadCandidate } from "@/lib/providers/lead-evaluator";
import { searchWeb, type SearchResult } from "@/lib/providers/tavily";
import {
  applyManualReviewQualification,
  applyLeadQualification,
  type DiscoveredContactRoute,
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
  updateCampaignStatus,
} from "./repository";
import { createActivityEvent } from "@/server/activity/repository";
import { getWorkspaceContext } from "@/server/workspaces/repository";

type UpdateCampaignStatusInput = {
  campaignId: string;
  status: CampaignStatus;
};

const controlStatuses = new Set<CampaignStatus>(["completed", "paused", "running"]);
const italyPharmacyFallbackQueries = [
  "site:.it farmacia online contatti Italia",
  "site:.it parafarmacia contatti Italia",
  "site:.it grossista farmaceutico Italia contatti",
  "site:.it distributore farmaceutico Italia",
  "site:.it distributore prodotti sanitari farmacia",
  "site:.it dispositivi medici farmacia distributore Italia",
  "site:.it forniture farmacia Italia contatti",
  "site:.it cooperativa farmaceutica Italia",
  "site:.it gruppo farmacie Italia contatti",
  "site:.it prodotti parafarmaceutici distributore Italia",
  "site:.it ingrosso prodotti farmaceutici Italia",
  "site:.it fornitori farmacie Italia",
];

export async function discoverCampaignLeadsAction(campaignId: string) {
  const { currentWorkspace } = await getWorkspaceContext();

  if (!currentWorkspace) {
    throw new Error("Authentication required");
  }

  const campaign = await getCampaign(currentWorkspace.id, campaignId);

  if (!campaign) {
    throw new Error("Campaign not found.");
  }

  const queries = buildCampaignSearchQueries(campaign);
  const results = await searchCampaignWeb(queries);
  const savedLeads = await importRawDiscoveredLeads(
    currentWorkspace.id,
    results.map((result) => ({
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

  await createActivityEvent(currentWorkspace.id, {
    description: `${savedLeads.length} Tavily lead source${savedLeads.length === 1 ? "" : "s"} saved for ${campaign.name}. ${qualification.successes.length} AI-qualified, ${qualification.failures.length} need manual review. ${contacts.routeCount} contact route${contacts.routeCount === 1 ? "" : "s"} found.`,
    entityExternalId: campaign.id,
    entityType: "campaign",
    label: "Campaign discovery run",
  });

  revalidatePath("/dashboard");
  revalidatePath("/leads");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaign.id}`);

  return {
    report: {
      aiQualificationFailures: qualification.failures,
      aiQualificationSuccesses: qualification.successes,
      contactRoutesFound: contacts.routeCount,
      finalReviewableLeads: savedLeads.map((lead) => lead.externalId),
      leadsSavedBeforeAiQualification: savedLeads.map((lead) => lead.externalId),
      queriesExecuted: queries,
      rawTavilyResults: results.map((result) => ({
        title: result.title,
        url: result.url,
      })),
    },
    message: `${savedLeads.length} discovered lead source${savedLeads.length === 1 ? "" : "s"} saved. ${qualification.successes.length} AI-qualified, ${qualification.failures.length} need manual review. ${contacts.routeCount} contact route${contacts.routeCount === 1 ? "" : "s"} found.`,
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
  const results = await Promise.all(queries.map((query) => searchWeb(query)));

  return dedupeSearchResults(results.flat());
}

async function qualifySavedLeads(
  workspaceId: string,
  campaign: Campaign,
  savedLeads: SavedDiscoveredLead[],
) {
  const successes: string[] = [];
  const failures: Array<{ error: string; leadId: string }> = [];

  for (const lead of savedLeads) {
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

  for (const lead of savedLeads) {
    const routes = await discoverContactRoutes(lead.result);
    await replaceLeadContactRoutes(lead.databaseId, routes);
    routeCount += routes.length;
  }

  return { routeCount };
}

async function discoverContactRoutes(result: SearchResult) {
  const snippets = [result.content];
  const origin = getOrigin(result.url);

  for (const path of ["/contatti", "/contatto", "/contact", "/contacts"]) {
    const pageText = await fetchContactPageText(`${origin}${path}`);

    if (pageText) {
      snippets.push(pageText);
    }
  }

  return extractContactRoutes(snippets.join("\n"), origin);
}

async function fetchContactPageText(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "OutreachSaaSAgent/0.1 contact discovery",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return "";
    }

    return (await response.text()).replace(/<[^>]+>/g, " ").slice(0, 12000);
  } catch {
    return "";
  }
}

function extractContactRoutes(text: string, source: string): DiscoveredContactRoute[] {
  const routes = new Map<string, DiscoveredContactRoute>();
  const emailMatches = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  const phoneMatches = text.match(/(?:\+39\s?)?(?:0\d{1,3}[\s./-]?)?\d{5,10}/g) ?? [];

  for (const email of emailMatches.slice(0, 5)) {
    routes.set(`email:${email.toLowerCase()}`, {
      source,
      suggestedRole: "General contact or sales office",
      type: "Email",
      value: email,
      verification: "source_confirmed",
    });
  }

  for (const phone of phoneMatches.slice(0, 3)) {
    routes.set(`phone:${phone.replace(/\D/g, "")}`, {
      source,
      suggestedRole: "General switchboard",
      type: "Phone",
      value: phone.trim(),
      verification: "source_confirmed",
    });
  }

  routes.set(`website:${source}`, {
    source,
    suggestedRole: "Contact page review",
    type: "Website",
    value: `${source}/contatti`,
    verification: "unverified",
  });

  return [...routes.values()];
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

function buildCampaignSearchQueries(campaign: Campaign) {
  if (isItalyPharmacyCampaign(campaign)) {
    return italyPharmacyFallbackQueries;
  }

  return [
    [
      campaign.strategy.terms.slice(0, 3).join(" "),
      campaign.targetSegments.slice(0, 2).join(" "),
      campaign.industryTerms.slice(0, 2).join(" "),
      campaign.geography,
      "company contact",
    ]
      .filter(Boolean)
      .join(" "),
  ];
}

function isItalyPharmacyCampaign(campaign: Campaign) {
  const text = [
    campaign.name,
    campaign.geography,
    campaign.objective,
    ...campaign.targetSegments,
    ...campaign.industryTerms,
    ...campaign.strategy.terms,
    ...campaign.strategy.localizedTerms,
    ...campaign.strategy.criteria,
  ]
    .join(" ")
    .toLowerCase();

  return (
    /\bitaly\b|\bitalia\b/.test(text) &&
    /farmacia|pharmacy|parafarmacia|farmaceutic|dispositivi medici/.test(text)
  );
}

function dedupeSearchResults(results: SearchResult[]) {
  const seen = new Set<string>();

  return results.filter((result) => {
    const key = result.url.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function getOrigin(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}
