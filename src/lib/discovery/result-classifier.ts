import type {
  Confidence,
  DiscoveryReportRejectedResult,
  DiscoveryReportResult,
} from "@/types/domain";
import type { SearchResult } from "@/lib/providers/tavily";

export type SearchResultWithQuery = SearchResult & {
  query: string;
};

export type SourceType =
  | "article_or_news"
  | "association"
  | "company_contact_page"
  | "company_website"
  | "directory"
  | "irrelevant"
  | "job_posting"
  | "marketplace"
  | "registry"
  | "social_profile"
  | "unknown";

export type SourceClassification = {
  confidence: Confidence;
  reasons: string[];
  riskFlags: string[];
  sourceType: SourceType;
};

export type ClassifiedSearchResult = SearchResultWithQuery & {
  classification: SourceClassification;
};

export type ClassifiedSearchResults = {
  acceptedResults: ClassifiedSearchResult[];
  duplicateResults: DiscoveryReportRejectedResult[];
  rawResults: DiscoveryReportResult[];
  rejectedResults: DiscoveryReportRejectedResult[];
};

const directoryHosts = [
  "clutch.co",
  "crunchbase.com",
  "dnb.com",
  "europages.",
  "kompass.",
  "paginebianche.it",
  "paginegialle.it",
  "sortlist.",
  "themanifest.com",
  "yell.com",
];

const registryHosts = [
  "aifa.gov.it",
  "beta.companieshouse.gov.uk",
  "business-sweden.com",
  "companieshouse.gov.uk",
  "gov.uk",
  "registroimprese.it",
  "ufficiocamerale.it",
];

export function classifySearchResults(
  results: SearchResultWithQuery[],
): ClassifiedSearchResults {
  const acceptedResults: ClassifiedSearchResult[] = [];
  const duplicateResults: DiscoveryReportRejectedResult[] = [];
  const rejectedResults: DiscoveryReportRejectedResult[] = [];
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  for (const result of results) {
    const classification = classifySearchResult(result);
    const classifiedResult = { ...result, classification };

    if (!isPotentialLeadSource(classification)) {
      rejectedResults.push(
        toRejectedResult(
          result,
          [...classification.reasons, ...classification.riskFlags].join("; "),
        ),
      );
      continue;
    }

    const urlKey = normalizeUrlKey(result.url);
    const domainKey = normalizeDomainKey(result.url);

    if (seenUrls.has(urlKey)) {
      duplicateResults.push(toRejectedResult(result, "Duplicate result URL"));
      continue;
    }

    if (domainKey && seenDomains.has(domainKey)) {
      duplicateResults.push(toRejectedResult(result, "Duplicate company domain"));
      continue;
    }

    seenUrls.add(urlKey);

    if (domainKey) {
      seenDomains.add(domainKey);
    }

    acceptedResults.push(classifiedResult);
  }

  return {
    acceptedResults,
    duplicateResults,
    rawResults: results.map((result) => ({
      query: result.query,
      title: result.title,
      url: result.url,
    })),
    rejectedResults,
  };
}

export function classifySearchResult(result: SearchResultWithQuery): SourceClassification {
  const hostname = getHostname(result.url);
  const path = getPathname(result.url);
  const haystack = `${result.title} ${result.url} ${result.content}`.toLowerCase();
  const reasons: string[] = [];
  const riskFlags: string[] = [];

  if (!isHttpUrl(result.url)) {
    return {
      confidence: "high",
      reasons: ["URL is not an HTTP website"],
      riskFlags: ["unsupported_url"],
      sourceType: "irrelevant",
    };
  }

  if (haystack.includes(".pdf")) {
    return {
      confidence: "high",
      reasons: ["PDF result rather than a company web page"],
      riskFlags: ["pdf"],
      sourceType: "irrelevant",
    };
  }

  if (isSocialHost(hostname)) {
    return {
      confidence: "high",
      reasons: ["Social profile, not a company website"],
      riskFlags: ["social_profile"],
      sourceType: "social_profile",
    };
  }

  if (isJobPage(haystack, path)) {
    return {
      confidence: "high",
      reasons: ["Job or career page"],
      riskFlags: ["job_posting"],
      sourceType: "job_posting",
    };
  }

  if (isMarketplace(hostname, haystack)) {
    reasons.push("Marketplace or ecommerce platform");
    return { confidence: "medium", reasons, riskFlags, sourceType: "marketplace" };
  }

  if (matchesHost(hostname, registryHosts) || hostname.endsWith(".gov")) {
    reasons.push("Registry or government source");
    return { confidence: "medium", reasons, riskFlags, sourceType: "registry" };
  }

  if (matchesHost(hostname, directoryHosts)) {
    reasons.push("Business directory source");
    return { confidence: "medium", reasons, riskFlags, sourceType: "directory" };
  }

  if (isAssociation(haystack, hostname)) {
    reasons.push("Association or member-list source");
    return { confidence: "medium", reasons, riskFlags, sourceType: "association" };
  }

  if (isArticleOrNews(haystack, hostname, path)) {
    reasons.push("Editorial or news source");
    return { confidence: "medium", reasons, riskFlags, sourceType: "article_or_news" };
  }

  if (isContactPage(path, haystack)) {
    reasons.push("Company contact page");
    return {
      confidence: "medium",
      reasons,
      riskFlags,
      sourceType: "company_contact_page",
    };
  }

  if (hostname) {
    reasons.push("Likely company website");
    return { confidence: "medium", reasons, riskFlags, sourceType: "company_website" };
  }

  reasons.push("Could not confidently classify source");
  riskFlags.push("unknown_source_type");
  return { confidence: "low", reasons, riskFlags, sourceType: "unknown" };
}

function isPotentialLeadSource(classification: SourceClassification) {
  return (
    classification.sourceType === "company_website" ||
    classification.sourceType === "company_contact_page" ||
    classification.sourceType === "association" ||
    classification.sourceType === "directory"
  );
}

function isArticleOrNews(haystack: string, hostname: string, path: string) {
  return (
    /(news|notizie|article|artikel|press|blog|magazine|journal|insight|report)/.test(
      hostname,
    ) ||
    /\/(news|notizie|article|press|blog|magazine|insights?|reports?)\b/.test(path) ||
    /\b(article|interview|press release|market report|case study)\b/.test(haystack)
  );
}

function isAssociation(haystack: string, hostname: string) {
  return (
    /(association|assoc|alliance|federation|chamber|members|member-list)/.test(
      haystack,
    ) || /(association|federation|chamber|alliance)/.test(hostname)
  );
}

function isContactPage(path: string, haystack: string) {
  return (
    /\/(contact|contacts|contact-us|contatti|kontakt|kontakt-os|about|about-us)\b/.test(
      path,
    ) || /\b(contact us|contatti|kontakt|company profile)\b/.test(haystack)
  );
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isJobPage(haystack: string, path: string) {
  return (
    /\/(careers|jobs?|vacancies|recruitment|lavora-con-noi|karriere)\b/.test(path) ||
    /\b(job opening|career|vacancy|hiring|recruitment)\b/.test(haystack)
  );
}

function isMarketplace(hostname: string, haystack: string) {
  return (
    /(amazon|ebay|alibaba|etsy|subito|marketplace|shopify|appsource)/.test(hostname) ||
    /\b(add to cart|marketplace seller|online marketplace)\b/.test(haystack)
  );
}

function isSocialHost(hostname: string) {
  return /(facebook|instagram|linkedin|youtube|x\.com|twitter|tiktok)\.com$/.test(
    hostname,
  );
}

function matchesHost(hostname: string, patterns: string[]) {
  return patterns.some((pattern) => hostname.includes(pattern));
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

function normalizeDomainKey(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function getPathname(url: string) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}

function toRejectedResult(result: SearchResultWithQuery, reason: string) {
  return {
    query: result.query,
    reason,
    title: result.title,
    url: result.url,
  };
}
