import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("qualification writes immutable clean results, dimensions, and evidence", () => {
  const section = repository.slice(
    repository.indexOf("export async function applyLeadQualification"),
    repository.indexOf("export async function replaceLeadContactRoutes"),
  );
  assert.match(section, /persistCleanQualification/);
  assert.doesNotMatch(
    section,
    /\.from\("leads"\)|lead_evidence_claims|lead_qualification_dimensions/,
  );

  assert.match(repository, /\.from\("qualification_results"\)/);
  assert.match(repository, /\.from\("qualification_dimensions"\)/);
  assert.match(repository, /\.from\("qualification_evidence"\)/);
  assert.match(repository, /input_hash: inputHash/);
});

test("qualification retry idempotency is keyed by campaign company and input hash", () => {
  assert.match(repository, /\.eq\("campaign_company_id", input\.campaignCompanyId\)/);
  assert.match(repository, /\.eq\("input_hash", inputHash\)/);
  assert.match(repository, /if \(existing\) return existing\.id/);
});
