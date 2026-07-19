import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const searchWorker = readFileSync(new URL("./search-web.ts", import.meta.url), "utf8");
const evaluationWorker = readFileSync(
  new URL("./evaluate-lead.ts", import.meta.url),
  "utf8",
);

for (const [name, source] of [
  ["discovery", searchWorker],
  ["qualification", evaluationWorker],
] as const) {
  test(`${name} worker uses only frozen seller and strategy context`, () => {
    assert.doesNotMatch(source, /\.from\(["']offers["']\)/);
    assert.doesNotMatch(source, /offer_external_id/);
    assert.match(source, /campaign_profile_snapshots/);
    assert.match(source, /strategy_version_id/);
    assert.match(source, /Research run is missing its frozen strategy/);
  });
}
