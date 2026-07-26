import assert from "node:assert/strict";
import test from "node:test";
import { requireOpenRouterConfig } from "./config.ts";

test("missing OpenRouter API configuration fails with a useful message", () => {
  const previous = process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  try {
    assert.throws(() => requireOpenRouterConfig(), /Add OPENROUTER_API_KEY/);
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previous;
  }
});
