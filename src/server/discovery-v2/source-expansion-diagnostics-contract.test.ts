import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(
  "src/server/discovery-v2/provider-repository.ts",
  "utf8",
);

test("source expansion validates its page and retains PostgreSQL diagnostics", () => {
  assert.match(repository, /discoverySourceExtractionPageSchema\.parse/);
  assert.match(repository, /error\.code/);
  assert.match(repository, /error\.details/);
  assert.match(repository, /error\.hint/);
  assert.match(repository, /formatDatabaseError\(expansionError\)/);
});
