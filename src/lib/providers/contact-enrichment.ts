import type { ContactRoute } from "../../types/domain.ts";
import { extractContactRoutesFromEvidence } from "../discovery/contact-extractor.ts";
import { searchWeb, type SearchResult } from "./tavily.ts";

export type EnrichedContactRoute = ContactRoute & {
  provenance: {
    provider: "tavily";
    query: string;
    sourceTitle: string;
    sourceUrl: string;
    verifiedAt: string;
  };
};

type ContactSearch = (query: string, maxResults?: number) => Promise<SearchResult[]>;

export async function enrichCompanyContacts(
  input: { company: string; website: string },
  search: ContactSearch = searchWeb,
): Promise<EnrichedContactRoute[]> {
  const query = buildContactEnrichmentQuery(input);
  const results = await search(query, 6);
  const verifiedAt = new Date().toISOString();

  return results.flatMap((result) =>
    extractContactRoutesFromEvidence({
      sourceUrl: result.url,
      text: [result.title, result.url, result.content].join("\n"),
      website: getSameCompanyWebsite(input.website, result.url),
    }).map((route) => ({
      ...route,
      provenance: {
        provider: "tavily" as const,
        query,
        sourceTitle: result.title,
        sourceUrl: result.url,
        verifiedAt,
      },
    })),
  );
}

export function buildContactEnrichmentQuery(input: { company: string; website: string }) {
  const domain = getHostname(input.website);
  const site = domain ? `site:${domain}` : "";
  return [site, `"${input.company.replaceAll('"', "")}"`, "contact email phone"]
    .filter(Boolean)
    .join(" ");
}

function getSameCompanyWebsite(website: string, resultUrl: string) {
  const companyHost = getHostname(website);
  const resultHost = getHostname(resultUrl);
  return companyHost && resultHost.endsWith(companyHost) ? website : undefined;
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
