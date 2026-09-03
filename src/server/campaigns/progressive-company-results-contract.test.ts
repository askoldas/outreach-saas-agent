import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(
  "src/server/campaigns/workflow-repository.ts",
  "utf8",
);

test("Company Research exposes canonical organizations instead of source pages", () => {
  assert.match(repository, /\.from\("campaign_candidates"\)/);
  assert.match(repository, /display_organization_id/);
  assert.match(repository, /\.from\("companies"\)/);
  assert.match(repository, /\.from\("company_domains"\)/);
  assert.match(repository, /progressiveCompanies:/);
  assert.match(repository, /candidate_qualification_batch_members_v2/);
  assert.match(repository, /progressiveOutcomeByCandidate/);
  const progressiveProjectionStart = repository.indexOf("progressiveCompanies: (");
  const progressiveProjectionEnd = repository.indexOf(
    "runEvents:",
    progressiveProjectionStart,
  );
  assert.doesNotMatch(
    repository.slice(progressiveProjectionStart, progressiveProjectionEnd),
    /source_url|source_query/,
  );
});
