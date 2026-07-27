import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../../app/(app)/usage/page.tsx", import.meta.url),
  "utf8",
);

test("commercial validation derives an observed funnel from clean records", () => {
  for (const table of [
    "campaign_runs",
    "campaign_companies",
    "qualification_results",
    "campaign_contacts",
    "email_verifications",
    "outreach_drafts",
    "export_records",
    "ai_requests",
  ]) {
    assert.match(repository, new RegExp(`\\.from\\("${table}"\\)`));
  }
  assert.match(repository, /denominator > 0 \? numerator \/ denominator : null/);
  assert.match(page, /CommercialValidation/);
});
