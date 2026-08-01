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

test("native Company Intelligence extraction uses bounded structured generation", () => {
  const source = readFileSync(
    new URL("../../server/company-profile-v3/stage-service.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /generateTextResult/);
  assert.match(source, /maxCompletionTokens: input\.definition\.maxCompletionTokens/);
  assert.match(source, /validateStructuredOutput/);
  assert.match(source, /jsonSchema/);
  assert.match(source, /repairMessages/);
});

test("OpenRouter can require strict JSON Schema output from compatible providers", () => {
  const source = readFileSync(new URL("./openrouter.ts", import.meta.url), "utf8");
  assert.match(source, /type: "json_schema"/);
  assert.match(source, /strict: options\.jsonSchema\.strict \?\? true/);
  assert.doesNotMatch(source, /require_parameters: true/);
});

test("critical OpenRouter roles use only the configured paid fallback", () => {
  assert.deepEqual(getOpenRouterFallbackModels("profile_analysis"), [
    "openai/gpt-5-mini",
  ]);
});

test("OpenRouter performs one request and leaves durable retries to Trigger.dev", () => {
  const source = readFileSync(new URL("./openrouter.ts", import.meta.url), "utf8");
  const generation = source.slice(
    source.indexOf("export async function generateTextResult"),
    source.indexOf("export function describeEmptyCompletion"),
  );
  assert.equal(generation.match(/await fetch\(/g)?.length, 1);
  assert.doesNotMatch(generation, /for \(let attempt/);
});
