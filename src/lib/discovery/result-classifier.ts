import type {
  DiscoveryReportRejectedResult,
  DiscoveryReportResult,
} from "@/types/domain";
import type { SearchResult } from "@/lib/providers/tavily";

export type SearchResultWithQuery = SearchResult & {
  query: string;
};

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

  if (!isHttpUrl(result.url)) {
    return "Unsupported URL";
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

function toRejectedResult(result: SearchResultWithQuery, reason: string) {
  return {
    query: result.query,
    reason,
    title: result.title,
    url: result.url,
  };
}
