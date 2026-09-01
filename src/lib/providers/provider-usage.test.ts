import assert from "node:assert/strict";
import test from "node:test";
import { generateTextResult } from "./openrouter.ts";
import { searchWebResult } from "./tavily.ts";

test("OpenRouter exposes reasoning and cached token metadata", async () => {
  process.env.OPENROUTER_API_KEY = "test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      id: "generation-1",
      model: "anthropic/claude-sonnet-4.6",
      choices: [{ message: { content: "{}" }, finish_reason: "stop" }],
      usage: {
        prompt_tokens: 20,
        completion_tokens: 8,
        prompt_tokens_details: { cached_tokens: 5 },
        completion_tokens_details: { reasoning_tokens: 3 },
        cost: 0.04,
      },
    }));
  try {
    const result = await generateTextResult([{ role: "user", content: "test" }], {
      role: "profile_analysis",
    });
    assert.equal(result.reasoningTokens, 3);
    assert.equal(result.cachedTokens, 5);
    assert.equal(result.providerReportedCost, 0.04);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Tavily exposes provider units and request attribution", async () => {
  process.env.TAVILY_API_KEY = "test";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ request_id: "tavily-1", usage: { credits: 2 }, results: [] }));
  try {
    const result = await searchWebResult("example");
    assert.equal(result.usage.providerRequestId, "tavily-1");
    assert.equal(result.usage.providerUnits, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
