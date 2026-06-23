import type { Campaign } from "@/types/domain";

const maxDiscoveryQueries = 12;

const contactIntentTerms = ["contatti", "contact", "azienda"];

export function buildCampaignSearchQueries(campaign: Campaign): string[] {
  const siteFilter = getSiteFilter(campaign.geography);
  const localizedTerms = campaign.strategy.localizedTerms.length
    ? campaign.strategy.localizedTerms
    : campaign.strategy.terms;
  const primaryTerms = unique([
    ...localizedTerms,
    ...campaign.industryTerms,
    ...campaign.targetSegments,
  ]);
  const segmentTerms = unique([
    ...campaign.targetSegments,
    ...campaign.industryTerms,
  ]);
  const queries: string[] = [];

  for (const term of primaryTerms.slice(0, 8)) {
    queries.push(joinQuery([siteFilter, term, campaign.geography, "contatti"]));
  }

  for (const segment of segmentTerms.slice(0, 4)) {
    const localTerm = localizedTerms[queries.length % Math.max(localizedTerms.length, 1)];
    queries.push(joinQuery([siteFilter, segment, localTerm, campaign.geography]));
  }

  if (queries.length === 0) {
    queries.push(
      joinQuery([
        siteFilter,
        campaign.geography,
        campaign.objective,
        "company contact",
      ]),
    );
  }

  return unique(queries)
    .map(addContactIntentWhenMissing)
    .slice(0, maxDiscoveryQueries);
}

function addContactIntentWhenMissing(query: string) {
  const lowerQuery = query.toLowerCase();

  if (contactIntentTerms.some((term) => lowerQuery.includes(term))) {
    return query;
  }

  return `${query} contatti`;
}

function getSiteFilter(geography: string) {
  const normalized = geography.toLowerCase();

  if (/\bitaly\b|\bitalia\b/.test(normalized)) {
    return "site:.it";
  }

  return "";
}

function joinQuery(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

function unique(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}
