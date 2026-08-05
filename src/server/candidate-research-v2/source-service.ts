import { createHash } from "node:crypto";
import {
  createFirstPartyFetchRequest,
  preferredPageKindsForQuestion,
  type WebsitePageKind,
} from "../../lib/candidate-intelligence-v2/index.ts";
import {
  extractWebPages,
  searchWeb,
  type SearchResult,
} from "../../lib/providers/tavily.ts";
import { assertIntelligenceExternalCallsAllowed } from "../../lib/intelligence/external-call-controls.ts";
import type {
  CandidateResearchMemberContext,
  CandidateResearchSource,
} from "./repository.ts";

const maximumStoredContentLength = 100_000;
const minimumUsefulPageLength = 80;

type SourceDependencies = {
  discoverPages?: typeof searchWeb;
  extractPages?: typeof extractWebPages;
  now?: () => string;
  persistSource?: PersistSource;
};

type PersistSource = (input: {
  workspaceId: string;
  memberId: string;
  sourceKind: "discovery" | "first_party_fetch";
  providerSourceRecordId?: string;
  sourceUrl: string;
  pageKind: string;
  content: string;
  contentHash: string;
  retrievedAt: string;
}) => Promise<CandidateResearchSource>;

const fallbackPaths: Record<WebsitePageKind, string> = {
  home: "/",
  about: "/about",
  products_services: "/products",
  brands_partners: "/partners",
  locations: "/locations",
  legal: "/legal",
  supplier_procurement: "/suppliers",
  careers: "/careers",
  investor_relations: "/investors",
  news: "/news",
  contact: "/contact",
  wholesale_b2b: "/wholesale",
};

export async function collectCandidateResearchSources(
  member: CandidateResearchMemberContext,
  dependencies: SourceDependencies = {},
): Promise<{ sources: CandidateResearchSource[]; warnings: string[] }> {
  const discoverPages = dependencies.discoverPages ?? searchWeb;
  const extractPages = dependencies.extractPages ?? extractWebPages;
  const persistSource = dependencies.persistSource ?? defaultPersistSource;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const sources = new Map(
    member.persistedSources.map((source) => [source.evidenceId, source] as const),
  );
  const warnings: string[] = [];
  const discoverySources = member.discoverySources
    .map((source) => ({ ...source, content: rawContent(source.rawPayload) }))
    .filter(({ content, sourceUrl }) => Boolean(sourceUrl && content.trim()))
    .sort(
      (left, right) =>
        right.content.length - left.content.length ||
        left.providerSourceRecordId.localeCompare(right.providerSourceRecordId),
    )
    .slice(0, member.sourcePlan.maximumDiscoverySources);

  for (const source of discoverySources) {
    const content = source.content.slice(0, maximumStoredContentLength);
    const persisted = await persistSource({
      workspaceId: member.workspaceId,
      memberId: member.memberId,
      sourceKind: "discovery",
      providerSourceRecordId: source.providerSourceRecordId,
      sourceUrl: source.sourceUrl!,
      pageKind: pageKindFromRawPayload(source.rawPayload),
      content,
      contentHash: digest(content),
      retrievedAt: source.retrievedAt,
    });
    sources.set(persisted.evidenceId, persisted);
  }

  if (
    !member.canonicalDomain ||
    !member.canonicalUrl ||
    !(member.sourcePlan.maximumFirstPartyFetches > 0)
  ) {
    return orderedResult(sources, warnings);
  }

  const maximumFetches = Math.min(
    member.plan.pageBudget,
    member.plan.stopPolicy.maximumPages,
    member.sourcePlan.maximumFirstPartyFetches,
  );
  const existingFirstParty = [...sources.values()].filter(
    ({ sourceKind }) => sourceKind === "first_party_fetch",
  );
  if (requiredQuestionsCovered(member, existingFirstParty)) {
    return orderedResult(sources, warnings);
  }

  assertIntelligenceExternalCallsAllowed("provider");
  const discovered = await discoverSameDomainPages({
    canonicalDomain: member.canonicalDomain,
    preferredPages: member.sourcePlan.preferredPages,
    discoverPages,
    warnings,
  });
  const candidates = rankFirstPartyPageCandidates({
    canonicalUrl: member.canonicalUrl,
    canonicalDomain: member.canonicalDomain,
    preferredPages: member.sourcePlan.preferredPages,
    discovered,
  });
  let fetchedCount = existingFirstParty.length;
  const firstPartySources = [...existingFirstParty];
  for (const candidate of candidates) {
    if (fetchedCount >= maximumFetches) break;
    if (requiredQuestionsCovered(member, firstPartySources)) break;
    try {
      const request = createFirstPartyFetchRequest({
        organizationId: member.organizationId,
        url: candidate.url,
        expectedDomain: member.canonicalDomain,
        pageKind: candidate.pageKind,
        questionKeys: member.plan.questions
          .filter((question) =>
            preferredPageKindsForQuestion(question).includes(candidate.pageKind),
          )
          .map(({ key }) => key),
      });
      const [result] = await extractPages([request.canonicalUrl]);
      fetchedCount += 1;
      if (!result?.content.trim()) {
        warnings.push(`${candidate.pageKind} returned no usable public content.`);
        continue;
      }
      const verifiedResult = verifyExtractedFirstPartyResult(
        result,
        member.canonicalDomain,
      );
      const content = verifiedResult.content.slice(0, maximumStoredContentLength);
      const persisted = await persistSource({
        workspaceId: member.workspaceId,
        memberId: member.memberId,
        sourceKind: "first_party_fetch",
        sourceUrl: verifiedResult.url,
        pageKind: candidate.pageKind,
        content,
        contentHash: digest(content),
        retrievedAt: now(),
      });
      sources.set(persisted.evidenceId, persisted);
      firstPartySources.push(persisted);
    } catch (error) {
      fetchedCount += 1;
      warnings.push(
        `${candidate.pageKind} could not be fetched: ${boundedMessage(error)}`,
      );
    }
  }

  return orderedResult(sources, warnings);
}

async function discoverSameDomainPages(input: {
  canonicalDomain: string;
  preferredPages: WebsitePageKind[];
  discoverPages: typeof searchWeb;
  warnings: string[];
}) {
  try {
    return await input.discoverPages(
      `site:${input.canonicalDomain} ${input.preferredPages
        .map((kind) => kind.replaceAll("_", " "))
        .join(" OR ")}`,
      Math.min(20, Math.max(6, input.preferredPages.length * 2)),
      { includeDomains: [input.canonicalDomain] },
    );
  } catch (error) {
    input.warnings.push(`Same-domain page discovery failed: ${boundedMessage(error)}`);
    return [];
  }
}

export function rankFirstPartyPageCandidates(input: {
  canonicalUrl: string;
  canonicalDomain: string;
  preferredPages: WebsitePageKind[];
  discovered: SearchResult[];
}) {
  const byKind = new Map<WebsitePageKind, string[]>();
  for (const result of input.discovered) {
    if (!isSameDomain(result.url, input.canonicalDomain)) continue;
    const kind = pageKindFromUrl(result.url);
    if (!kind || !input.preferredPages.includes(kind)) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), result.url]);
  }
  const seen = new Set<string>();
  return input.preferredPages.flatMap((pageKind) => {
    const discoveredUrl = byKind.get(pageKind)?.[0];
    const fallbackUrl = new URL(fallbackPaths[pageKind], input.canonicalUrl).toString();
    const url = canonicalizeUrl(discoveredUrl ?? fallbackUrl);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{ pageKind, url }];
  });
}

function requiredQuestionsCovered(
  member: CandidateResearchMemberContext,
  sources: CandidateResearchSource[],
) {
  if (!member.plan.stopPolicy.stopWhenRequiredQuestionsResolved) return false;
  const required = member.plan.questions.filter(({ required }) => required);
  return (
    required.length > 0 &&
    required.every((question) =>
      sources.some(
        (source) =>
          source.content.trim().length >= minimumUsefulPageLength &&
          preferredPageKindsForQuestion(question).includes(
            source.pageKind as WebsitePageKind,
          ) &&
          contentSupportsQuestion(source.content, question.key),
      ),
    )
  );
}

function contentSupportsQuestion(content: string, questionKey: string) {
  const normalized = content.toLowerCase();
  if (questionKey === "products_services") {
    return /\b(?:product|service|solution|capabilit)/.test(normalized);
  }
  if (questionKey === "operating_markets") {
    return /\b(?:location|office|operate|market|address|country|countries)/.test(
      normalized,
    );
  }
  if (questionKey === "procurement_authority") {
    return /\b(?:supplier|procurement|purchasing|vendor|sourcing)/.test(normalized);
  }
  if (/partner|distribution|relationship/.test(questionKey)) {
    return /\b(?:partner|distribut|dealer|reseller|relationship)/.test(normalized);
  }
  return true;
}

function verifyExtractedFirstPartyResult(result: SearchResult, canonicalDomain: string) {
  if (!isSameDomain(result.url, canonicalDomain)) {
    throw new Error("Extracted page redirected outside the canonical domain.");
  }
  return result;
}

function pageKindFromUrl(value: string): WebsitePageKind | undefined {
  let path: string;
  try {
    path = new URL(value).pathname.toLowerCase();
  } catch {
    return undefined;
  }
  if (/\b(?:products?|services?|solutions?|capabilities)\b/.test(path))
    return "products_services";
  if (/\b(?:partners?|brands?|distribution|dealers?)\b/.test(path))
    return "brands_partners";
  if (/\b(?:locations?|offices?|where-we-operate)\b/.test(path)) return "locations";
  if (/\b(?:suppliers?|procurement|purchasing|vendor)\b/.test(path))
    return "supplier_procurement";
  if (/\b(?:careers?|jobs?)\b/.test(path)) return "careers";
  if (/\b(?:investors?|investor-relations)\b/.test(path)) return "investor_relations";
  if (/\b(?:news|press|media)\b/.test(path)) return "news";
  if (/\b(?:contact|contact-us)\b/.test(path)) return "contact";
  if (/\b(?:legal|imprint|privacy|terms)\b/.test(path)) return "legal";
  if (/\b(?:wholesale|b2b)\b/.test(path)) return "wholesale_b2b";
  if (/\b(?:about|company|who-we-are)\b/.test(path)) return "about";
  if (path === "/" || path === "") return "home";
  return undefined;
}

function rawContent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const content = (value as Record<string, unknown>).content;
  return typeof content === "string" ? content : "";
}

function pageKindFromRawPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "other";
  const kind = (value as Record<string, unknown>).pageType;
  if (kind === "company_homepage") return "home";
  if (kind === "company_subpage") return "about";
  return "other";
}

function isSameDomain(value: string, expectedDomain: string) {
  try {
    const actual = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    const expected = expectedDomain.toLowerCase().replace(/^www\./, "");
    return actual === expected || actual.endsWith(`.${expected}`);
  } catch {
    return false;
  }
}

function canonicalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

function orderedResult(
  sources: Map<string, CandidateResearchSource>,
  warnings: string[],
) {
  return {
    sources: [...sources.values()].sort(
      (left, right) =>
        left.retrievedAt.localeCompare(right.retrievedAt) ||
        left.evidenceId.localeCompare(right.evidenceId),
    ),
    warnings,
  };
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function boundedMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

async function defaultPersistSource(input: Parameters<PersistSource>[0]) {
  const { persistCandidateResearchSource } = await import("./repository.ts");
  return persistCandidateResearchSource(input);
}
