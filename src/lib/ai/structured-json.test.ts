import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseCompleteJsonObject } from "./structured-json.ts";

test("extracts a complete object from fenced provider reasoning", () => {
  const expected = {
    geography: { countryCodes: ["LV"] },
    offering: { profileOfferingIds: ["offering-1"] },
  };
  assert.deepEqual(
    parseCompleteJsonObject(
      `<think>Return the requested object.</think>\n\`\`\`json\n${JSON.stringify(expected)}\n\`\`\``,
    ),
    expected,
  );
});

test("does not complete truncated provider JSON", () => {
  assert.equal(
    parseCompleteJsonObject('```json\n{"offering":{"title":"Example"}'),
    undefined,
  );
});

test("campaign recommendation and market planning use the tolerant parser", () => {
  const campaign = readFileSync(
    new URL("./campaign-brief-proposal.ts", import.meta.url),
    "utf8",
  );
  const market = readFileSync(
    new URL("../campaign-workflow/market-planning.ts", import.meta.url),
    "utf8",
  );
  assert.match(campaign, /parseCompleteJsonObject\(rawOutput\)/);
  assert.match(market, /parseCompleteJsonObject\(modelCall\.data\)/);
  assert.doesNotMatch(campaign, /JSON\.parse\(modelCall\.data\)/);
  assert.doesNotMatch(market, /JSON\.parse\(modelCall\.data\)/);
});
