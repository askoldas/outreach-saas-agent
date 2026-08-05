import assert from "node:assert/strict";
import test from "node:test";
import {
  generateTextResult,
  OpenRouterRequestError,
} from "./openrouter.ts";

const environmentKeys = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL_ROUTING_ENABLED",
  "OPENROUTER_ALLOW_FALLBACKS",
] as const;

test("OpenRouter retries a truncated completion once with a larger compact budget", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  const requests: Array<Record<string, unknown>> = [];

  try {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL_ROUTING_ENABLED = "true";
    process.env.OPENROUTER_ALLOW_FALLBACKS = "false";
    globalThis.fetch = (async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const firstAttempt = requests.length === 1;
      return new Response(
        JSON.stringify({
          id: firstAttempt ? "request-1" : "request-2",
          model: "openai/gpt-5-mini",
          choices: [
            {
              finish_reason: firstAttempt ? "length" : "stop",
              message: {
                content: firstAttempt
                  ? '{"answer":"unfinished'
                  : '{"answer":"complete"}',
              },
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: firstAttempt ? 4_000 : 120,
            total_tokens: firstAttempt ? 4_100 : 220,
            cost: firstAttempt ? 0.02 : 0.003,
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await generateTextResult(
      [{ role: "user", content: "Return JSON." }],
      {
        role: "low_risk_transformation",
        jsonMode: true,
        maxCompletionTokens: 4_000,
        reasoningEffort: "medium",
        taskName: "test task",
      },
    );

    assert.equal(requests.length, 2);
    assert.equal(requests[0]?.max_completion_tokens, 4_000);
    assert.equal(requests[1]?.max_completion_tokens, 6_000);
    assert.deepEqual(requests[1]?.reasoning, {
      effort: "minimal",
      exclude: true,
    });
    const retryMessages = requests[1]?.messages as Array<{
      content: string;
      role: string;
    }>;
    assert.match(retryMessages.at(-1)?.content ?? "", /completion limit/i);
    assert.equal(result.data, '{"answer":"complete"}');
    assert.equal(result.truncationRetryUsed, true);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("OpenRouter stops after one compact truncation retry", async () => {
  const originalFetch = globalThis.fetch;
  const originalEnvironment = Object.fromEntries(
    environmentKeys.map((key) => [key, process.env[key]]),
  );
  let calls = 0;

  try {
    process.env.OPENROUTER_API_KEY = "test-key";
    process.env.OPENROUTER_MODEL_ROUTING_ENABLED = "true";
    process.env.OPENROUTER_ALLOW_FALLBACKS = "false";
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          model: "openai/gpt-5-mini",
          choices: [
            {
              finish_reason: "length",
              message: { content: '{"answer":"unfinished' },
            },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await assert.rejects(
      generateTextResult([{ role: "user", content: "Return JSON." }], {
        role: "low_risk_transformation",
        jsonMode: true,
        maxCompletionTokens: 4_000,
        taskName: "test task",
      }),
      (error: unknown) =>
        error instanceof OpenRouterRequestError &&
        error.code === "completion_truncated" &&
        /after one compact retry/i.test(error.message),
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of environmentKeys) {
      const value = originalEnvironment[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
