import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cache = readFileSync(
  new URL("./provider-result-cache.ts", import.meta.url),
  "utf8",
);

test("provider results are cached by stable input hash before final persistence", () => {
  assert.match(cache, /inputHash/);
  assert.match(cache, /providerResults/);
  assert.match(cache, /\[cacheKey\]/);
  assert.match(cache, /\.in\("status", \["pending", "running"\]\)/);
  assert.doesNotMatch(cache, /Date\.now\(\).*inputHash/);
});
