import assert from "node:assert/strict";
import test from "node:test";
import { getOpenRouterTimeoutMs } from "./openrouter.ts";

test("OpenRouter uses a worker-safe timeout by default", () => {
  const previous = process.env.OPENROUTER_TIMEOUT_MS;
  delete process.env.OPENROUTER_TIMEOUT_MS;
  assert.equal(getOpenRouterTimeoutMs(), 120_000);
  restore(previous);
});

test("OpenRouter timeout is configurable with a safe minimum", () => {
  const previous = process.env.OPENROUTER_TIMEOUT_MS;
  process.env.OPENROUTER_TIMEOUT_MS = "75000";
  assert.equal(getOpenRouterTimeoutMs(), 75_000);
  process.env.OPENROUTER_TIMEOUT_MS = "1000";
  assert.equal(getOpenRouterTimeoutMs(), 120_000);
  restore(previous);
});

function restore(value: string | undefined) {
  if (value === undefined) delete process.env.OPENROUTER_TIMEOUT_MS;
  else process.env.OPENROUTER_TIMEOUT_MS = value;
}
