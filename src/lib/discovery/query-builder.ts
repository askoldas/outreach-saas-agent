import type { Campaign } from "@/types/domain";

const maxDiscoveryQueries = 12;

const contactIntentTerms = ["contatti", "contact", "azienda"];
const italianBuyerIntentTerms = [
  "fornitore farmacia",
  "distributore farmaceutico",
  "grossista farmaceutico",
  "distributore prodotti sanitari",
  "fornitore parafarmacia",
  "prodotti sanitari farmacia",
];

export function buildCampaignSearchQueries(campaign: Campaign): string[] {
  const siteFilter = getSiteFilter(campaign.geography);
  const localGeography = getLocalizedGeography(campaign.geography);
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

  for (const term of primaryTerms.slice(0, 6)) {
    queries.push(joinQuery([siteFilter, term, localGeography, "azienda contatti"]));
  }

  for (const segment of segmentTerms.slice(0, 3)) {
    const localTerm = localizedTerms[queries.length % Math.max(localizedTerms.length, 1)];
    queries.push(joinQuery([siteFilter, segment, localTerm, localGeography]));
  }

  if (isItaly(campaign.geography)) {
    for (const intent of italianBuyerIntentTerms) {
      queries.push(joinQuery([siteFilter, intent, localGeography, "azienda contatti"]));
    }
  }

  if (queries.length === 0) {
    queries.push(
      joinQuery([
        siteFilter,
        localGeography,
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
  if (isItaly(geography)) {
    return "site:.it";
  }

  return "";
}

function getLocalizedGeography(geography: string) {
  return isItaly(geography) ? "Italia" : geography;
}

function isItaly(geography: string) {
  return /\bitaly\b|\bitalia\b/.test(geography.toLowerCase());
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
