import { createHash } from "node:crypto";
import { z } from "zod";

export const DISCOVERY_SOURCE_EXTRACTION_VERSION = "discovery-source-public-links/v1.0";

export const extractedOrganizationSchema = z
  .object({
    referenceKey: z.string().length(64),
    name: z.string().min(2).max(200),
    websiteUrl: z.url().optional(),
    canonicalDomainHint: z.string().min(3).optional(),
    discoverySourceUrl: z.url(),
    extractionMethod: z.enum(["public_link", "name_only_list_item"]),
    extractionVersion: z.string().min(1),
    sourceOrdinal: z.number().int().nonnegative(),
  })
  .strict();

export const discoverySourceExtractionPageSchema = z
  .object({
    organizations: z.array(extractedOrganizationSchema),
    offset: z.number().int().nonnegative(),
    nextOffset: z.number().int().nonnegative().nullable(),
    totalOrganizations: z.number().int().nonnegative(),
    exhausted: z.boolean(),
    extractionVersion: z.string().min(1),
  })
  .strict();

export type ExtractedOrganization = z.infer<typeof extractedOrganizationSchema>;
export type DiscoverySourceExtractionPage = z.infer<
  typeof discoverySourceExtractionPageSchema
>;

const ignoredHosts = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "x.com",
  "youtube.com",
  "google.com",
  "bing.com",
  "wikipedia.org",
]);

/**
 * Deterministically expands a public directory page. The offset/limit contract
 * permits retry-safe continuation without pretending the first chunk exhausted
 * a larger source. Domains are accepted only from explicit links.
 */
export function extractOrganizationsFromDiscoverySource(input: {
  sourceUrl: string;
  content: string;
  offset?: number;
  maximumOrganizations?: number;
}): DiscoverySourceExtractionPage {
  const maximum = Math.max(1, Math.min(input.maximumOrganizations ?? 25, 50));
  const offset = Math.max(0, Math.floor(input.offset ?? 0));
  const sourceHost = normalizedDomain(input.sourceUrl);
  const byIdentity = new Map<string, Omit<ExtractedOrganization, "sourceOrdinal">>();

  for (const item of explicitLinks(input.content)) {
    const name = cleanName(item.name);
    const url = cleanUrl(item.url);
    const domain = url ? normalizedDomain(url) : undefined;
    if (!name || !url || !domain || domain === sourceHost || ignoredHosts.has(domain))
      continue;
    const identity = `domain:${domain}`;
    if (!byIdentity.has(identity)) {
      byIdentity.set(identity, {
        referenceKey: digest(`${input.sourceUrl}|${identity}`),
        name,
        websiteUrl: new URL(url).origin,
        canonicalDomainHint: domain,
        discoverySourceUrl: input.sourceUrl,
        extractionMethod: "public_link",
        extractionVersion: DISCOVERY_SOURCE_EXTRACTION_VERSION,
      });
    }
  }

  for (const name of nameOnlyListItems(input.content)) {
    const normalized = comparableName(name);
    if (!normalized || byIdentity.has(`name:${normalized}`)) continue;
    if ([...byIdentity.values()].some((item) => comparableName(item.name) === normalized))
      continue;
    const identity = `name:${normalized}`;
    byIdentity.set(identity, {
      referenceKey: digest(`${input.sourceUrl}|${identity}`),
      name,
      discoverySourceUrl: input.sourceUrl,
      extractionMethod: "name_only_list_item",
      extractionVersion: DISCOVERY_SOURCE_EXTRACTION_VERSION,
    });
  }

  const all = [...byIdentity.values()].map((organization, sourceOrdinal) =>
    extractedOrganizationSchema.parse({ ...organization, sourceOrdinal }),
  );
  const organizations = all.slice(offset, offset + maximum);
  const nextOffset = offset + organizations.length;
  return discoverySourceExtractionPageSchema.parse({
    organizations,
    offset,
    nextOffset: nextOffset < all.length ? nextOffset : null,
    totalOrganizations: all.length,
    exhausted: nextOffset >= all.length,
    extractionVersion: DISCOVERY_SOURCE_EXTRACTION_VERSION,
  });
}

function explicitLinks(content: string) {
  return [
    ...[...content.matchAll(/\[([^\]]{2,200})\]\((https?:\/\/[^\s)]+)\)/gi)].map(
      (match) => ({ name: match[1], url: match[2] }),
    ),
    ...[
      ...content.matchAll(
        /<a\b[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([^<]{2,200})<\/a>/gi,
      ),
    ].map((match) => ({ name: match[2], url: match[1] })),
  ];
}

function nameOnlyListItems(content: string) {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:[-*•]|\d+[.)])\s+([^[(<]{2,200})\s*$/u)?.[1])
    .map(cleanName)
    .filter((value): value is string => Boolean(value));
}

function cleanName(value: string | undefined) {
  const clean = value
    ?.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  if (
    !clean ||
    /^(?:website|visit|read more|learn more|details|home|members?|directory)$/i.test(
      clean,
    )
  )
    return undefined;
  return clean.slice(0, 200);
}

function cleanUrl(value: string | undefined) {
  try {
    const url = new URL(value?.replace(/&amp;/gi, "&") ?? "");
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function normalizedDomain(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

function comparableName(value: string) {
  return value.toLowerCase().replace(/[^\p{Letter}\p{Number}]+/gu, "");
}

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
