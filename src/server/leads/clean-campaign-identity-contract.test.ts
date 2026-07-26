import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(
  new URL("./clean-repository.ts", import.meta.url),
  "utf8",
);

test("clean lead read models expose external Campaign IDs while filtering through the relation", () => {
  assert.match(repository, /campaign:campaigns!inner/);
  assert.match(repository, /\.eq\("campaign\.external_id", campaignId\)/);
  assert.match(repository, /campaignId: row\.campaign\.external_id/);
  assert.doesNotMatch(repository, /campaignId: row\.campaign_id/);
});
