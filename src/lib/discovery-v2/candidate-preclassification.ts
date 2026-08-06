import type { SearchResult } from "../providers/tavily.ts";
import type {
  CandidatePreclassification,
  ProviderDiscoveryRequest,
} from "./contracts.ts";
import type { WebResultPageType } from "./providers/web-normalization.ts";

export const CANDIDATE_PRECLASSIFIER_VERSION =
  "commercial-candidate-preclassification/v1.0";

type Input = {
  pageType: WebResultPageType;
  result: SearchResult;
  segment: ProviderDiscoveryRequest["segment"];
  sourceRecordKey: string;
};

const sourceOnlyTypes = new Set<WebResultPageType>([
  "directory_list",
  "association_member_list",
  "marketplace_listing",
  "registry_record",
  "news_article",
  "document",
  "content_page",
  "social_profile",
  "map_listing",
]);

const relationshipPatterns = [
  [
    "supplier",
    /\b(?:suppliers?|manufactur(?:e|er|es|ed|ing)|contract manufacturing|we suppl(?:y|ied|ies))\b/i,
  ],
  ["distributor", /\b(?:distributor|wholesaler|importer|we distribute)\b/i],
  ["reseller", /\b(?:reseller|dealer|retailer)\b/i],
  [
    "implementation_partner",
    /\b(?:systems? integrator|implementation partner|consultancy)\b/i,
  ],
] as const;

const countryTlds: Record<string, string> = {
  de: "DE",
  ee: "EE",
  fr: "FR",
  lt: "LT",
  lv: "LV",
  pl: "PL",
  uk: "GB",
};

export function preclassifyWebResult(input: Input): CandidatePreclassification {
  const evidence = `${input.result.title} ${input.result.content.slice(0, 2_000)}`;
  const probableRelationships: string[] = relationshipPatterns
    .filter(([, pattern]) => pattern.test(evidence))
    .map(([relationship]) => relationship);
  const geographyPlausible = reliableGeographyPlausibility(
    input.result.url,
    input.segment.geography.countryCodes,
  );
  const common = {
    sourceRecordKey: input.sourceRecordKey,
    probableRelationshipTypes: probableRelationships,
    geographyPlausible,
    matchedSegmentId: input.segment.id,
    matchedArchetypeId: input.segment.archetypeId,
    strategyVersionId: input.segment.strategyVersionId,
    positiveSignals: input.segment.positiveSignals
      .filter((signal) => evidence.toLowerCase().includes(signal.label.toLowerCase()))
      .map((signal) => signal.key),
    negativeSignals: input.segment.negativeSignals
      .filter((signal) => evidence.toLowerCase().includes(signal.label.toLowerCase()))
      .map((signal) => signal.key),
    sourceEvidenceIds: [input.sourceRecordKey],
    classifierVersion: CANDIDATE_PRECLASSIFIER_VERSION,
  };
  if (sourceOnlyTypes.has(input.pageType)) {
    return {
      ...common,
      disposition: "source_only" as const,
      probableOrganizationType: sourceType(input.pageType),
      objectiveCompatibility: "unknown" as const,
      reasonCodes: [`page_type:${input.pageType}`],
      confidence: 0.98,
    };
  }
  if (input.pageType === "unknown") {
    return {
      ...common,
      disposition: "reject" as const,
      probableOrganizationType: "unknown" as const,
      objectiveCompatibility: "unknown" as const,
      reasonCodes: ["missing_reliable_organization_identity"],
      confidence: 0.9,
    };
  }
  const excludedDomain = explicitExcludedDomain(
    input.segment.exclusionRules,
    input.result.url,
  );
  if (excludedDomain) {
    return {
      ...common,
      disposition: "reject" as const,
      probableOrganizationType: "operating_company" as const,
      objectiveCompatibility: "incompatible" as const,
      reasonCodes: ["known_hard_exclusion", `excluded_domain:${excludedDomain}`],
      confidence: 0.99,
    };
  }
  if (geographyPlausible === false) {
    return {
      ...common,
      disposition: "reject" as const,
      probableOrganizationType: "operating_company" as const,
      objectiveCompatibility: "unknown" as const,
      reasonCodes: ["reliable_geography_mismatch"],
      confidence: 0.92,
    };
  }
  const relationshipCompatible =
    probableRelationships.length === 0
      ? "unknown"
      : probableRelationships.includes(input.segment.relationshipType)
        ? "compatible"
        : "incompatible";
  if (relationshipCompatible === "incompatible") {
    return {
      ...common,
      disposition: "reject" as const,
      probableOrganizationType: "operating_company" as const,
      objectiveCompatibility: relationshipCompatible,
      reasonCodes: ["explicit_incompatible_commercial_role"],
      confidence: 0.86,
    };
  }
  return {
    ...common,
    disposition:
      input.pageType === "company_homepage"
        ? ("candidate" as const)
        : ("needs_review" as const),
    probableOrganizationType: "operating_company" as const,
    objectiveCompatibility: relationshipCompatible,
    reasonCodes: [
      input.pageType === "company_homepage"
        ? "plausible_company_homepage"
        : "ambiguous_company_subpage",
    ],
    confidence: input.pageType === "company_homepage" ? 0.78 : 0.62,
  };
}

function explicitExcludedDomain(
  rules: ProviderDiscoveryRequest["segment"]["exclusionRules"],
  url: string,
) {
  let domain: string;
  try {
    domain = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
  for (const rule of rules) {
    if (
      rule.ruleType !== "hard_exclusion" ||
      rule.strength !== "hard" ||
      rule.status !== "confirmed"
    ) {
      continue;
    }
    const domains = `${rule.label} ${rule.description}`
      .toLowerCase()
      .match(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/g);
    const match = domains?.find(
      (excluded) => domain === excluded || domain.endsWith(`.${excluded}`),
    );
    if (match) return match;
  }
  return undefined;
}

function sourceType(pageType: WebResultPageType) {
  if (pageType === "directory_list" || pageType === "association_member_list")
    return "association" as const;
  if (pageType === "marketplace_listing") return "marketplace" as const;
  if (pageType === "news_article" || pageType === "content_page")
    return "publication" as const;
  if (pageType === "social_profile") return "non_company_host" as const;
  return "unknown" as const;
}

function reliableGeographyPlausibility(url: string, targetCountries: string[]) {
  try {
    const finalLabel = new URL(url).hostname.toLowerCase().split(".").at(-1);
    const observedCountry = finalLabel ? countryTlds[finalLabel] : undefined;
    if (!observedCountry) return null;
    return targetCountries
      .map((country) => country.toUpperCase())
      .includes(observedCountry);
  } catch {
    return null;
  }
}
