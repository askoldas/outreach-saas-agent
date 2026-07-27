import { createHash } from "node:crypto";
import type { SearchResult } from "../../providers/tavily.ts";
import type {
  NormalizedProviderCandidateInput,
  ProviderSourceRecordInput,
} from "../contracts.ts";
import type { WebDiscoveryQuery } from "./web-query-generator.ts";

export type WebResultPageType =
  | "company_homepage"
  | "company_subpage"
  | "directory_list"
  | "association_member_list"
  | "marketplace_listing"
  | "registry_record"
  | "news_article"
  | "social_profile"
  | "map_listing"
  | "document"
  | "unknown";

const nonCompanyHosts = new Set([
  "facebook.com",
  "linkedin.com",
  "instagram.com",
  "youtube.com",
  "wikipedia.org",
  "google.com",
  "bing.com",
]);

export function normalizeWebSearchResult(input: {
  result: SearchResult;
  query: WebDiscoveryQuery;
  rank: number;
  providerVersion: string;
  retrievedAt: string;
  archetypeId: string;
}): {
  record: ProviderSourceRecordInput;
  candidate?: NormalizedProviderCandidateInput;
} {
  const pageType = classifyWebResult(input.result);
  const rawPayload = {
    title: input.result.title,
    url: input.result.url,
    content: input.result.content,
    score: input.result.score,
    pageType,
    providerVersion: input.providerVersion,
    query: {
      id: input.query.id,
      family: input.query.family,
      language: input.query.language,
      purpose: input.query.purpose,
    },
  };
  const sourceRecordKey = digest(`${input.query.fingerprint}|${input.result.url}`);
  const record: ProviderSourceRecordInput = {
    sourceRecordKey,
    providerRecordId: digest(input.result.url),
    sourceType:
      pageType === "directory_list" || pageType === "association_member_list"
        ? "industry_directory"
        : "web_search",
    sourceUrl: input.result.url,
    resultRank: input.rank,
    queryOrFilterFingerprint: input.query.fingerprint,
    rawPayload,
    rawPayloadHash: digest(JSON.stringify(rawPayload)),
    retrievedAt: input.retrievedAt,
  };
  if (
    [
      "directory_list",
      "association_member_list",
      "marketplace_listing",
      "news_article",
      "social_profile",
      "document",
    ].includes(pageType)
  ) {
    return { record };
  }
  const domain = canonicalDomainHint(input.result.url);
  const name = cleanResultName(input.result.title);
  if (!name) return { record };
  return {
    record,
    candidate: {
      sourceRecordKey,
      name,
      ...(domain ? { canonicalDomainHint: domain } : {}),
      websiteUrl: input.result.url,
      sourceUrl: input.result.url,
      description: input.result.content.slice(0, 1000),
      organizationTypeHint: pageType === "company_homepage" ? "company" : "unknown",
      matchedSegmentId: input.query.discoverySegmentId,
      matchedArchetypeId: input.archetypeId,
      matchedSignals:
        input.query.family === "positive_signal" ? [input.query.purpose] : [],
      preliminaryQuality: {
        likelyOperatingOrganization: pageType === "company_homepage" ? true : null,
        likelyTargetGeography: null,
        hasUsableIdentity: Boolean(domain || name),
        confidence: pageType === "company_homepage" ? 0.7 : 0.4,
      },
      createdAt: input.retrievedAt,
    },
  };
}

export function classifyWebResult(result: SearchResult): WebResultPageType {
  const value =
    `${result.title} ${result.url} ${result.content.slice(0, 300)}`.toLowerCase();
  if (/\.pdf(?:$|[?#])/.test(result.url.toLowerCase())) return "document";
  if (/(linkedin|facebook|instagram|youtube)\.com/.test(value)) return "social_profile";
  if (/\b(news|press release|reported|article)\b/.test(value)) return "news_article";
  if (/\b(marketplace|seller listing|shop)\b/.test(value)) return "marketplace_listing";
  if (/\b(member list|members directory|association members)\b/.test(value))
    return "association_member_list";
  if (/\b(directory|companies list|business listing)\b/.test(value))
    return "directory_list";
  if (/\b(registry|company register)\b/.test(value)) return "registry_record";
  try {
    const url = new URL(result.url);
    return url.pathname === "/" || url.pathname === ""
      ? "company_homepage"
      : "company_subpage";
  } catch {
    return "unknown";
  }
}

export function canonicalDomainHint(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (
      !hostname ||
      [...nonCompanyHosts].some(
        (host) => hostname === host || hostname.endsWith(`.${host}`),
      )
    )
      return undefined;
    return hostname;
  } catch {
    return undefined;
  }
}

function cleanResultName(title: string) {
  return (
    title
      .split(/\s+[|–—-]\s+/)[0]
      ?.trim()
      .slice(0, 200) ?? ""
  );
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
