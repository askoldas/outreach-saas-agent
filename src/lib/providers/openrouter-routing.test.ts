import assert from "node:assert/strict";
import test from "node:test";
import { generateTextResult, OpenRouterRequestError } from "./openrouter.ts";

test("OpenRouter result records fallback, actual model, usage, request ID, and cost", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        id: "request_123",
        model: "openai/gpt-5-mini",
        choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
        usage: {
          prompt_tokens: 120,
          completion_tokens: 30,
          total_tokens: 150,
          cost: 0.0012,
        },
      }),
      { status: 200 },
    );
  try {
    const result = await generateTextResult(
      [{ role: "user", content: "Synthetic test" }],
      { role: "profile_analysis", jsonMode: true },
    );
    assert.equal(result.requestedModel, "anthropic/claude-sonnet-4.6");
    assert.equal(result.actualModel, "openai/gpt-5-mini");
    assert.equal(result.fallbackUsed, true);
    assert.match(result.fallbackReason ?? "", /configured fallback/);
    assert.equal(result.inputTokens, 120);
    assert.equal(result.outputTokens, 30);
    assert.equal(result.totalTokens, 150);
    assert.equal(result.providerRequestId, "request_123");
    assert.equal(result.providerReportedCost, 0.0012);
    assert.equal(result.providerCurrency, "USD");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});

test("provider timeout is retryable and clearly classified", async () => {
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-key";
  globalThis.fetch = async () => {
    throw new DOMException("timed out", "TimeoutError");
  };
  try {
    await assert.rejects(
      () =>
        generateTextResult([{ role: "user", content: "Synthetic test" }], {
          role: "guided_interpretation",
          timeoutMs: 5_000,
        }),
      (error: unknown) =>
        error instanceof OpenRouterRequestError &&
        error.code === "timeout" &&
        error.retryable,
    );
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousKey;
  }
});
