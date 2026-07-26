import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { describeEmptyCompletion, getOpenRouterFallbackModels } from "./openrouter.ts";

test("reports provider errors hidden inside successful OpenRouter responses", () => {
  assert.equal(
    describeEmptyCompletion({ error: { code: 429, message: "Provider rate limit" } }),
    "Provider error: Provider rate limit",
  );
});

test("reports finish reason and token usage for empty completions", () => {
  const message = describeEmptyCompletion({
    choices: [{ finish_reason: "length", message: { content: "" } }],
    usage: { completion_tokens: 0, prompt_tokens: 48_000 },
  });
  assert.match(message, /finish reason: length/);
  assert.match(message, /completion tokens: 0/);
  assert.match(message, /prompt tokens: 48000/);
});

test("Company Profile extraction disables expensive reasoning", () => {
  const source = readFileSync(
    new URL("../ai/company-profile-analysis.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /reasoningEffort:\s*"none"/);
});

test("Company Profile extraction reserves enough output for structured JSON", () => {
  const source = readFileSync(
    new URL("../ai/company-profile-analysis.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /maxCompletionTokens:\s*6_000/);
});

test("critical OpenRouter roles use only the configured paid fallback", () => {
  assert.deepEqual(getOpenRouterFallbackModels("profile_analysis"), [
    "openai/gpt-5-mini",
  ]);
});
