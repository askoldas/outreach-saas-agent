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
  | "content_page"
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

const companyIdentityPaths = new Set([
  "about",
  "about-us",
  "company",
  "contact",
  "contact-us",
  "corporate",
  "our-company",
  "organization",
  "organisation",
  "who-we-are",
]);
const companyCommercialPaths = new Set([
  "capabilities",
  "industries",
  "portfolio",
  "product",
  "products",
  "service",
  "services",
  "solution",
  "solutions",
]);

const localePathPattern = /^[a-z]{2}(?:-[a-z]{2})?$/i;
const editorialPathPattern =
  /(?:^|\/)(?:articles?|blog|case-studies|case-study|events?|guides?|insights?|knowledge|learn|magazine|media|news|podcasts?|press|press-releases?|publications?|reports?|research|resources?|stories|webinars?|whitepapers?)(?:\/|$)/i;
const editorialTitlePattern =
  /^(?:a |an |the )?(?:complete |essential |practical |ultimate )?(?:guide to|how (?:do|does|to|can|is|are|was|were|will|should)|what (?:is|are|does|do)|why (?:is|are|does|do)|top \d+|best \d*|ways? to|tips? for|benefits? of|effects? of|future of)\b/i;
const explicitArticlePathPattern = /(?:^|\/)articles?(?:\/|$)/i;
const genericPageTitles = new Set([
  "about",
  "about us",
  "company",
  "contact",
  "contact us",
  "corporate",
  "home",
  "homepage",
  "our company",
  "organization",
  "organisation",
  "who we are",
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
  if (!isDirectOrganizationPage(pageType)) return { record };

  const domain = canonicalDomainHint(input.result.url);
  const name = cleanResultName(input.result.title, input.result.url, pageType);
  const websiteUrl = websiteOrigin(input.result.url);
  if (!name || !domain || !websiteUrl) return { record };

  return {
    record,
    candidate: {
      sourceRecordKey,
      name,
      canonicalDomainHint: domain,
      websiteUrl,
      sourceUrl: input.result.url,
      description: input.result.content.slice(0, 1000),
      organizationTypeHint: "company",
      matchedSegmentId: input.query.discoverySegmentId,
      matchedArchetypeId: input.archetypeId,
      matchedSignals:
        input.query.family === "positive_signal" ? [input.query.purpose] : [],
      preliminaryQuality: {
        likelyOperatingOrganization: true,
        likelyTargetGeography: null,
        hasUsableIdentity: true,
        confidence: pageType === "company_homepage" ? 0.78 : 0.68,
      },
      createdAt: input.retrievedAt,
    },
  };
}

export function classifyWebResult(result: SearchResult): WebResultPageType {
  const title = result.title.trim();
  const titleAndUrl = `${title} ${result.url}`.toLowerCase();
  const titleUrlAndContent = `${titleAndUrl} ${result.content.slice(0, 1_000).toLowerCase()}`;
  if (/\.(?:docx?|pdf|pptx?)(?:$|[?#])/i.test(result.url)) return "document";
  if (/(linkedin|facebook|instagram|youtube)\.com/.test(titleAndUrl))
    return "social_profile";
  if (
    /\b(marketplace|seller listing|shop|sourcing platform|supplier platform)\b/.test(
      titleUrlAndContent,
    )
  )
    return "marketplace_listing";
  if (
    /\b(member list|members list|members directory|membership directory|association members)\b/.test(
      titleAndUrl,
    )
  )
    return "association_member_list";
  if (/\b(directory|companies list|business listing)\b/.test(titleAndUrl))
    return "directory_list";
  if (/\b(registry|company register)\b/.test(titleAndUrl)) return "registry_record";

  try {
    const url = new URL(result.url);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    if (
      pathSegments.length === 0 ||
      (pathSegments.length === 1 &&
        (localePathPattern.test(pathSegments[0]!) ||
          /^(?:default|home|index)(?:\.[a-z]+)?$/i.test(pathSegments[0]!)))
    ) {
      return "company_homepage";
    }
    if (explicitArticlePathPattern.test(url.pathname)) return "content_page";
    if (matchingHostBrand(title, result.url)) return "company_subpage";
    if (
      editorialPathPattern.test(url.pathname) ||
      editorialTitlePattern.test(title) ||
      /\b(?:article|blog post|news release|press release|whitepaper|research report)\b/i.test(
        title,
      )
    ) {
      return /\b(?:news|press release|news release)\b/i.test(titleAndUrl)
        ? "news_article"
        : "content_page";
    }
    const semanticSegments = pathSegments.map((segment) =>
      segment.replace(/\.[a-z]+$/i, "").toLowerCase(),
    );
    return semanticSegments.some(
      (segment) =>
        companyIdentityPaths.has(segment) || companyCommercialPaths.has(segment),
    )
      ? "company_subpage"
      : "unknown";
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
    ) {
      return undefined;
    }
    return hostname;
  } catch {
    return undefined;
  }
}

function isDirectOrganizationPage(pageType: WebResultPageType) {
  return pageType === "company_homepage" || pageType === "company_subpage";
}

function cleanResultName(title: string, url: string, pageType: WebResultPageType) {
  const titleParts = title
    .replace(/\s+/g, " ")
    .split(/\s+(?:\||-|–|—)\s+/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const domainName = domainDisplayName(url);
  const domainMatchedPart = matchingHostBrand(title, url);
  if (domainMatchedPart) return domainMatchedPart.slice(0, 200);
  if (pageType === "company_subpage") return domainName.slice(0, 200);
  const descriptivePart = titleParts.find(
    (part) =>
      !genericPageTitles.has(part.toLowerCase()) &&
      !editorialTitlePattern.test(part) &&
      part.length <= 100 &&
      part.split(/\s+/).length <= 12,
  );
  return (descriptivePart || domainName).slice(0, 200);
}

function matchingHostBrand(title: string, url: string) {
  const domainName = domainDisplayName(url);
  const domainKey = comparableName(domainName);
  if (domainKey.length < 3) return undefined;
  return title
    .replace(/\s+/g, " ")
    .split(/\s+(?:\||-|–|—)\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .find((part) => {
      const partKey = comparableName(part);
      return (
        partKey.length >= 3 &&
        (partKey.includes(domainKey) || domainKey.includes(partKey))
      );
    });
}

function websiteOrigin(value: string) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return undefined;
  }
}

function domainDisplayName(value: string) {
  const domain = canonicalDomainHint(value);
  if (!domain) return "";
  const label = domain.split(".")[0]?.replace(/[-_]+/g, " ").trim() ?? "";
  return label.replace(/\b\p{Letter}/gu, (character) => character.toUpperCase());
}

function comparableName(value: string) {
  return value.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
