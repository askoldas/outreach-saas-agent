import type { SearchResult } from "@/lib/providers/tavily";

const ignoredHosts = [
  "clutch.co",
  "crunchbase.com",
  "dnb.com",
  "europages.",
  "facebook.com",
  "instagram.com",
  "kompass.",
  "linkedin.com",
  "paginebianche.it",
  "paginegialle.it",
  "sortlist.",
  "themanifest.com",
  "x.com",
  "yell.com",
  "youtube.com",
];

export type DirectoryEntityCandidate = SearchResult & {
  directorySourceUrl: string;
  query: string;
};

export function extractDirectoryEntityCandidates(
  source: SearchResult & { query: string },
  extractedContent: string,
  limit = 5,
): DirectoryEntityCandidate[] {
  const sourceHost = hostname(source.url);
  const seen = new Set<string>();
  const candidates: DirectoryEntityCandidate[] = [];
  const urls = extractedContent.match(/https?:\/\/[^\s<>"')\]}]+/gi) ?? [];

  for (const rawUrl of urls) {
    const url = rawUrl.replace(/[.,;:!?]+$/g, "");
    const host = hostname(url);
    if (
      !host ||
      host === sourceHost ||
      host.endsWith(`.${sourceHost}`) ||
      ignoredHosts.some((ignored) => host.includes(ignored)) ||
      seen.has(host)
    ) {
      continue;
    }
    seen.add(host);
    candidates.push({
      content: `Company website referenced by directory source ${source.url}.`,
      directorySourceUrl: source.url,
      query: source.query,
      score: source.score,
      title: companyNameFromHost(host),
      url: origin(url),
    });
    if (candidates.length >= Math.max(0, Math.min(limit, 10))) break;
  }
  return candidates;
}

function companyNameFromHost(host: string) {
  const label = host.replace(/^www\./, "").split(".")[0] ?? host;
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function origin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}
