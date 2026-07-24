import { requireTavilyConfig } from "./config.ts";

type TavilySearchResult = {
  content?: string;
  raw_content?: string;
  score?: number;
  title?: string;
  url: string;
};

type TavilyExtractResponse = {
  results?: Array<{ raw_content?: string; url: string }>;
};

type TavilySearchResponse = {
  answer?: string;
  query?: string;
  results?: TavilySearchResult[];
};

export type SearchResult = {
  content: string;
  score: number | null;
  title: string;
  url: string;
};

export async function searchWeb(
  query: string,
  maxResults = 8,
  options: { includeDomains?: string[]; includeRawContent?: boolean } = {},
): Promise<SearchResult[]> {
  const { apiKey } = requireTavilyConfig();
  const response = await fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      include_answer: false,
      ...(options.includeDomains?.length
        ? { include_domains: options.includeDomains }
        : {}),
      ...(options.includeRawContent ? { include_raw_content: "text" } : {}),
      max_results: maxResults,
      query,
      search_depth: "basic",
    }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as TavilySearchResponse;
  return (payload.results ?? []).map((result) => ({
    content: result.raw_content?.trim() || result.content || "",
    score: typeof result.score === "number" ? result.score : null,
    title: result.title ?? result.url,
    url: result.url,
  }));
}

export async function extractWebPages(urls: string[]): Promise<SearchResult[]> {
  if (!urls.length) return [];
  const { apiKey } = requireTavilyConfig();
  const response = await fetch("https://api.tavily.com/extract", {
    body: JSON.stringify({ extract_depth: "basic", format: "text", urls }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Tavily extract failed with status ${response.status}.`);
  }
  const payload = (await response.json()) as TavilyExtractResponse;
  return (payload.results ?? []).map((result) => ({
    content: result.raw_content ?? "",
    score: null,
    title: result.url,
    url: result.url,
  }));
}
