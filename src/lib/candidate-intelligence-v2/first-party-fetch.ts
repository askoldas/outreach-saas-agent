import type { WebsitePageKind } from "./contracts.ts";

export type FirstPartyFetchRequest = {
  organizationId: string;
  canonicalUrl: string;
  pageKind: WebsitePageKind;
  questionKeys: string[];
  maximumBytes: number;
  timeoutMs: number;
};

export function createFirstPartyFetchRequest(input: {
  organizationId: string;
  url: string;
  expectedDomain: string;
  pageKind: WebsitePageKind;
  questionKeys: string[];
}): FirstPartyFetchRequest {
  const url = new URL(input.url);
  const expected = input.expectedDomain.toLowerCase().replace(/^www\./, "");
  const actual = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("First-party research requires an HTTP URL.");
  }
  if (actual !== expected && !actual.endsWith(`.${expected}`)) {
    throw new Error("First-party research URL is outside the canonical domain.");
  }
  url.hash = "";
  return {
    organizationId: input.organizationId,
    canonicalUrl: url.toString(),
    pageKind: input.pageKind,
    questionKeys: [...new Set(input.questionKeys)].sort(),
    maximumBytes: 1_000_000,
    timeoutMs: 20_000,
  };
}
