import { requireTavilyConfig } from "./config.ts";

const tavilyRequestTimeoutMs = 30_000;

type TavilySearchResult = {
  content?: string;
  raw_content?: string;
  score?: number;
  title?: string;
  url: string;
};

type TavilyExtractResponse = {
  request_id?: string;
  usage?: { credits?: number };
  results?: Array<{ raw_content?: string; url: string }>;
};

type TavilySearchResponse = {
  answer?: string;
  query?: string;
  results?: TavilySearchResult[];
  request_id?: string;
  usage?: { credits?: number };
};

export type TavilyUsage = {
  provider: "tavily";
  operation: "search" | "extract";
  providerRequestId?: string;
  providerUnits: number;
  searchDepth: "basic";
};

export type TavilyResult<T> = { data: T; usage: TavilyUsage };

export type SearchResult = {
  content: string;
  score: number | null;
  title: string;
  url: string;
};

export async function searchWeb(
  query: string,
  maxResults = 8,
  options: {
    country?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
    includeRawContent?: boolean;
  } = {},
): Promise<SearchResult[]> {
  return (await searchWebResult(query, maxResults, options)).data;
}

export async function searchWebResult(
  query: string,
  maxResults = 8,
  options: {
    country?: string;
    includeDomains?: string[];
    excludeDomains?: string[];
    includeRawContent?: boolean;
  } = {},
): Promise<TavilyResult<SearchResult[]>> {
  const { apiKey } = requireTavilyConfig();
  const response = await fetch("https://api.tavily.com/search", {
    body: JSON.stringify({
      include_answer: false,
      ...(options.country?.trim()
        ? { country: options.country.trim().toLowerCase() }
        : {}),
      ...(options.includeDomains?.length
        ? { include_domains: options.includeDomains }
        : {}),
      ...(options.excludeDomains?.length
        ? { exclude_domains: options.excludeDomains }
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
    signal: AbortSignal.timeout(tavilyRequestTimeoutMs),
  });

  if (!response.ok) {
    throw await tavilyHttpError(response, "search");
  }

  const payload = (await response.json()) as TavilySearchResponse;
  const data = (payload.results ?? []).map((result) => ({
    content: result.raw_content?.trim() || result.content || "",
    score: typeof result.score === "number" ? result.score : null,
    title: result.title ?? result.url,
    url: result.url,
  }));
  return {
    data,
    usage: {
      provider: "tavily",
      operation: "search",
      ...(payload.request_id ? { providerRequestId: payload.request_id } : {}),
      providerUnits: payload.usage?.credits ?? 1,
      searchDepth: "basic",
    },
  };
}

export async function extractWebPages(urls: string[]): Promise<SearchResult[]> {
  return (await extractWebPagesResult(urls)).data;
}

export async function extractWebPagesResult(
  urls: string[],
): Promise<TavilyResult<SearchResult[]>> {
  if (!urls.length)
    return {
      data: [],
      usage: {
        provider: "tavily",
        operation: "extract",
        providerUnits: 0,
        searchDepth: "basic",
      },
    };
  const { apiKey } = requireTavilyConfig();
  const response = await fetch("https://api.tavily.com/extract", {
    body: JSON.stringify({ extract_depth: "basic", format: "text", urls }),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    method: "POST",
    signal: AbortSignal.timeout(tavilyRequestTimeoutMs),
  });
  if (!response.ok) {
    throw await tavilyHttpError(response, "extract");
  }
  const payload = (await response.json()) as TavilyExtractResponse;
  const data = (payload.results ?? []).map((result) => ({
    content: result.raw_content ?? "",
    score: null,
    title: result.url,
    url: result.url,
  }));
  return {
    data,
    usage: {
      provider: "tavily",
      operation: "extract",
      ...(payload.request_id ? { providerRequestId: payload.request_id } : {}),
      providerUnits: payload.usage?.credits ?? urls.length,
      searchDepth: "basic",
    },
  };
}

async function tavilyHttpError(response: Response, operation: "search" | "extract") {
  const providerDetail = await readProviderErrorDetail(response);
  const reason =
    response.status === 432
      ? "plan usage limit exceeded"
      : response.status === 433
        ? "pay-as-you-go usage limit exceeded"
        : response.status === 429
          ? "rate limit exceeded"
          : "request failed";
  const detail =
    providerDetail && !providerDetail.toLowerCase().includes(reason)
      ? ` ${providerDetail}`
      : "";

  return new Error(
    `Tavily ${operation} failed: ${reason} (status ${response.status}).${detail}`.slice(
      0,
      700,
    ),
  );
}

async function readProviderErrorDetail(response: Response) {
  const body = (await response.text().catch(() => "")).trim();
  if (!body) return "";

  try {
    const parsed = JSON.parse(body) as {
      detail?: string | { error?: string; message?: string };
      error?: string;
      message?: string;
    };
    const detail =
      typeof parsed.detail === "string"
        ? parsed.detail
        : (parsed.detail?.error ?? parsed.detail?.message);
    return (detail ?? parsed.error ?? parsed.message ?? "").trim().slice(0, 500);
  } catch {
    return body.replace(/\s+/g, " ").slice(0, 500);
  }
}
