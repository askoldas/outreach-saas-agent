import assert from "node:assert/strict";
import test from "node:test";
import { extractWebPages, searchWeb } from "./tavily.ts";

test("Tavily search requests and prefers extracted raw website content", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TAVILY_API_KEY = "test-key";
  globalThis.fetch = async (_input, init) => {
    assert.ok(init?.signal);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.include_raw_content, "text");
    assert.deepEqual(body.include_domains, ["example.test"]);
    assert.equal(body.country, "lithuania");
    return Response.json({
      results: [
        {
          url: "https://example.test/about",
          title: "About",
          content: "short snippet",
          raw_content: "Complete extracted website content",
        },
      ],
    });
  };
  try {
    const results = await searchWeb("example", 8, {
      includeDomains: ["example.test"],
      includeRawContent: true,
      country: "Lithuania",
    });
    assert.equal(results[0]?.content, "Complete extracted website content");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Tavily extract provides direct URL fallback content", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TAVILY_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), "https://api.tavily.com/extract");
    assert.ok(init?.signal);
    return Response.json({
      results: [{ url: "https://example.test/", raw_content: "Homepage content" }],
    });
  };
  try {
    const results = await extractWebPages(["https://example.test/"]);
    assert.equal(results[0]?.content, "Homepage content");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Tavily plan-limit failures preserve an actionable provider error", async () => {
  const originalFetch = globalThis.fetch;
  process.env.TAVILY_API_KEY = "test-key";
  globalThis.fetch = async () =>
    Response.json(
      {
        detail: {
          error:
            "This request exceeds your plan's set usage limit. Please upgrade your plan.",
        },
      },
      { status: 432 },
    );
  try {
    await assert.rejects(
      searchWeb("example"),
      /Tavily search failed: plan usage limit exceeded \(status 432\)/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
