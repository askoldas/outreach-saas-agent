import { requireTavilyConfig } from "./config.ts";

type TavilySearchResult = {
  content?: string;
  score?: number;
  title?: string;
  url: string;
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

export async function searchWeb(query: string, maxResults = 8): Promise<SearchResult[]> {
  const { apiKey } = requireTavilyConfig();
  const response = await fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      include_answer: false,
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
    content: result.content ?? "",
    score: typeof result.score === "number" ? result.score : null,
    title: result.title ?? result.url,
    url: result.url,
  }));
}
