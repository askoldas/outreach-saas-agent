import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const service = readFileSync(
  fileURLToPath(new URL("./service.ts", import.meta.url)),
  "utf8",
);

test("candidate qualification runs in bounded parallel batches", () => {
  assert.match(service, /const qualificationConcurrency = 4/);
  assert.match(
    service,
    /accepted\.slice\(offset,\s*offset \+ qualificationConcurrency\)/,
  );
  assert.match(service, /await Promise\.all\(\s*batch\.map/);
  assert.doesNotMatch(
    service,
    /for \(const \[index, source\] of accepted\.entries\(\)\)/,
  );
});

test("parallel qualification preserves counters and checks controls between batches", () => {
  assert.match(service, /outcomes\.filter\(\(outcome\) => outcome\.qualified\)/);
  assert.match(service, /outcomes\.filter\(\(outcome\) => outcome\.failed\)/);
  assert.match(service, /evaluatedCount \+= batch\.length/);
  assert.match(service, /await isCampaignPaused\(context\)/);
  assert.match(service, /return data\.status === "paused"/);
  assert.match(service, /run\.status === "cancelled"/);
});
