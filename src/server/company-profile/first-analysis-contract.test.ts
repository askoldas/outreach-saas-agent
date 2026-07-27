import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../../app/(app)/company-profile/page.tsx", import.meta.url),
  "utf8",
);

test("first website analysis creates the initial profile version before enqueueing", () => {
  const analysisAction = actions.slice(
    actions.indexOf("export async function analyzeCompanyProfileAction"),
    actions.indexOf("function text("),
  );
  assert.match(analysisAction, /if \(!profile\.id\)/);
  assert.match(analysisAction, /createEmptyStructuredProfile/);
  assert.match(analysisAction, /profile = await saveCompanyProfileVersion/);
  assert.ok(
    analysisAction.indexOf("saveCompanyProfileVersion") <
      analysisAction.indexOf("enqueueCompanyProfileAnalysisRun"),
  );
  assert.match(page, /"website-required": "Save a website URL/);
});
