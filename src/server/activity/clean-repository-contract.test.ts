import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("activity writes use clean entity, event, and metadata columns", () => {
  assert.match(repository, /entity_id: entityId/);
  assert.match(repository, /event_type: toEventType\(input\.label\)/);
  assert.match(repository, /metadata: input\.entityExternalId/);
  assert.match(repository, /\.from\("campaigns"\)/);
  assert.doesNotMatch(repository, /entity_external_id:/);
});
