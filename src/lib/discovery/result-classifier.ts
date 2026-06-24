import type {
  DiscoveryReportRejectedResult,
  DiscoveryReportResult,
} from "@/types/domain";
import type { SearchResult } from "@/lib/providers/tavily";

export type SearchResultWithQuery = SearchResult & {
  query: string;
};

type LeadSourceType =
  | "article"
  | "company_site"
  | "directory"
  | "government"
  | "marketplace"
  | "social"
  | "unsupported";

export type ClassifiedSearchResults = {
  acceptedResults: SearchResultWithQuery[];
  duplicateResults: DiscoveryReportRejectedResult[];
  rawResults: DiscoveryReportResult[];
  rejectedResults: DiscoveryReportRejectedResult[];
};

export function classifySearchResults(
  results: SearchResultWithQuery[],
): ClassifiedSearchResults {
  const acceptedResults: SearchResultWithQuery[] = [];
  const duplicateResults: DiscoveryReportRejectedResult[] = [];
  const rejectedResults: DiscoveryReportRejectedResult[] = [];
  const seenDomains = new Set<string>();
  const seenUrls = new Set<string>();

  for (const result of results) {
    const rejectionReason = getDeterministicRejectionReason(result);

    if (rejectionReason) {
      rejectedResults.push(toRejectedResult(result, rejectionReason));
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

    acceptedResults.push(result);
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

function getDeterministicRejectionReason(result: SearchResultWithQuery) {
  const haystack = `${result.title} ${result.url}`.toLowerCase();
  const sourceType = classifyLeadSource(result);

  if (!isHttpUrl(result.url)) {
    return "Unsupported URL";
  }

  if (sourceType !== "company_site") {
    return `Not a company website (${sourceType})`;
  }

  if (haystack.includes(".pdf")) {
    return "PDF result, not a company page";
  }

  if (/\/(blog|news|press|careers|jobs?|lavora-con-noi)\b/.test(haystack)) {
    return "Editorial or jobs page";
  }

  if (/(facebook|instagram|linkedin|youtube|x\.com|twitter)\.com/.test(haystack)) {
    return "Social media page";
  }

  return "";
}

function classifyLeadSource(result: SearchResultWithQuery): LeadSourceType {
  const hostname = getHostname(result.url);
  const haystack = `${result.title} ${result.url}`.toLowerCase();

  if (!hostname) {
    return "unsupported";
  }

  if (/(facebook|instagram|linkedin|youtube|x\.com|twitter)\.com$/.test(hostname)) {
    return "social";
  }

  if (
    hostname.endsWith(".gov.it") ||
    hostname.endsWith(".gouv.fr") ||
    hostname.endsWith(".gov") ||
    hostname.includes("aifa.gov.it") ||
    hostname.includes("agenziafarmaco.gov.it")
  ) {
    return "government";
  }

  if (
    [
      "paginebianche.it",
      "paginegialle.it",
      "ufficiocamerale.it",
      "bancomail.it",
      "europages.",
      "kompass.",
      "registroimprese.it",
      "informazione-aziende.it",
      "reportaziende.it",
    ].some((domain) => hostname.includes(domain))
  ) {
    return "directory";
  }

  if (
    /(pharmaretail|pharmacy-scanner|farmakom|unife|quotidianosanita|healthdesk|news|blog|magazine)/.test(
      hostname,
    ) ||
    /\b(news|notizie|articolo|trattative|intervista|report|studio)\b/.test(haystack)
  ) {
    return "article";
  }

  if (/(amazon|ebay|alibaba|subito|marketplace)/.test(hostname)) {
    return "marketplace";
  }

  return "company_site";
}

function isHttpUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
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

function toRejectedResult(result: SearchResultWithQuery, reason: string) {
  return {
    query: result.query,
    reason,
    title: result.title,
    url: result.url,
  };
}
