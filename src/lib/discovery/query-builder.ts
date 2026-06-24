import type { Campaign, Offer } from "@/types/domain";

const maxDiscoveryQueries = 12;
const maxTermsPerFamily = 4;

type CampaignSearchContext = Campaign & {
  offer?: Pick<
    Offer,
    | "buyerTypes"
    | "capabilities"
    | "differentiators"
    | "keywords"
    | "limitations"
    | "name"
    | "problems"
    | "summary"
    | "type"
  > | null;
};

const countryHints: Record<
  string,
  {
    businessTerms: string[];
    countryAliases: string[];
    siteFilter?: string;
  }
> = {
  denmark: {
    businessTerms: ["virksomhed", "leverandor", "kontakt"],
    countryAliases: ["Denmark", "Danmark"],
    siteFilter: "site:.dk",
  },
  italy: {
    businessTerms: ["azienda", "fornitore", "contatti"],
    countryAliases: ["Italy", "Italia"],
    siteFilter: "site:.it",
  },
  sweden: {
    businessTerms: ["foretag", "leverantor", "kontakt"],
    countryAliases: ["Sweden", "Sverige"],
    siteFilter: "site:.se",
  },
  "united kingdom": {
    businessTerms: ["company", "provider", "contact"],
    countryAliases: ["United Kingdom", "UK", "Britain"],
    siteFilter: "site:.uk",
  },
  uk: {
    businessTerms: ["company", "provider", "contact"],
    countryAliases: ["United Kingdom", "UK"],
    siteFilter: "site:.uk",
  },
};

export function buildCampaignSearchQueries(campaign: CampaignSearchContext): string[] {
  const locale = getLocaleHints(campaign.geography);
  const geographyTerms = locale.countryAliases.length
    ? locale.countryAliases
    : [campaign.geography];
  const businessTerms = locale.businessTerms.length
    ? locale.businessTerms
    : ["company", "provider", "supplier", "contact"];
  const siteFilter = locale.siteFilter;
  const offer = campaign.offer ?? null;
  const buyerTerms = unique([
    ...campaign.targetSegments,
    ...(offer?.buyerTypes ?? []),
  ]);
  const industryTerms = unique([
    ...campaign.industryTerms,
    ...campaign.strategy.terms,
    ...campaign.strategy.localizedTerms,
    ...(offer?.keywords ?? []),
  ]);
  const solutionTerms = unique([
    offer?.name ?? "",
    offer?.type ?? "",
    ...(offer?.capabilities ?? []),
    ...(offer?.problems ?? []),
    ...(offer?.differentiators ?? []),
  ]);
  const queries: string[] = [];

  for (const term of industryTerms.slice(0, maxTermsPerFamily)) {
    queries.push(
      joinQuery([
        siteFilter,
        term,
        geographyTerms[0],
        businessTerms[0],
        businessTerms.at(-1),
      ]),
    );
  }

  for (const buyer of buyerTerms.slice(0, maxTermsPerFamily)) {
    const industry = industryTerms[queries.length % Math.max(industryTerms.length, 1)];
    queries.push(joinQuery([siteFilter, buyer, industry, geographyTerms[0], "company"]));
  }

  for (const solution of solutionTerms.slice(0, maxTermsPerFamily)) {
    const buyer = buyerTerms[queries.length % Math.max(buyerTerms.length, 1)];
    queries.push(
      joinQuery([siteFilter, solution, buyer, geographyTerms[0], getObjectiveIntent(campaign)]),
    );
  }

  const primaryIndustry = industryTerms[0] ?? solutionTerms[0] ?? campaign.objective;
  queries.push(joinQuery([siteFilter, primaryIndustry, geographyTerms[0], "directory"]));
  queries.push(joinQuery([siteFilter, primaryIndustry, geographyTerms[0], "association members"]));

  if (isPartnerObjective(campaign.objective)) {
    queries.push(joinQuery([siteFilter, primaryIndustry, geographyTerms[0], "distributor partner"]));
    queries.push(joinQuery([siteFilter, primaryIndustry, geographyTerms[0], "reseller"]));
  }

  if (isServiceOffer(offer?.type)) {
    queries.push(joinQuery([siteFilter, primaryIndustry, geographyTerms[0], "service provider"]));
  }

  if (queries.length === 0) {
    queries.push(
      joinQuery([siteFilter, campaign.objective, campaign.geography, "B2B company contact"]),
    );
  }

  return unique(queries)
    .map((query) => ensureBusinessIntent(query, businessTerms))
    .slice(0, maxDiscoveryQueries);
}

function ensureBusinessIntent(query: string, businessTerms: string[]) {
  const lowerQuery = query.toLowerCase();
  const hasIntent = [
    "company",
    "supplier",
    "provider",
    "manufacturer",
    "distributor",
    "partner",
    "directory",
    "association",
    "contact",
    ...businessTerms,
  ].some((term) => lowerQuery.includes(term.toLowerCase()));

  return hasIntent ? query : `${query} company contact`;
}

function getLocaleHints(geography: string) {
  const normalized = geography.toLowerCase();
  const key =
    Object.keys(countryHints).find((candidate) => normalized.includes(candidate)) ?? "";

  return key
    ? (countryHints[key] ?? { businessTerms: [], countryAliases: [geography] })
    : {
        businessTerms: [],
        countryAliases: [geography],
      };
}

function getObjectiveIntent(campaign: CampaignSearchContext) {
  if (isPartnerObjective(campaign.objective)) {
    return "distributor partner";
  }

  if (campaign.objective.toLowerCase().includes("subcontract")) {
    return "subcontracting company";
  }

  return "buyer company";
}

function isPartnerObjective(objective: string) {
  return /(distributor|reseller|partner|channel|agent)/i.test(objective);
}

function isServiceOffer(type: Offer["type"] | undefined) {
  return type === "service" || type === "software";
}

function joinQuery(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

function unique(items: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const item of items.map((value) => value.trim()).filter(Boolean)) {
    const key = item.toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      output.push(item);
    }
  }

  return output;
}
