import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Company Profile analysis dispatches through Trigger.dev with clean execution state", async () => {
  const [repository, task, service] = await Promise.all([
    readFile(new URL("../research/repository.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../../trigger/analyze-company-profile.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("./analysis-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(repository, /tasks\.trigger<.*analyzeCompanyProfileTask>/s);
  assert.match(repository, /\.from\("provider_executions"\)/);
  assert.match(repository, /operation:\s*"company_profile_analysis"/);
  assert.doesNotMatch(
    repository.slice(
      repository.indexOf("export async function enqueueCompanyProfileAnalysisRun"),
      repository.indexOf("export async function getCampaignResearchProgress"),
    ),
    /research_(runs|tasks)/,
  );

  assert.match(task, /id:\s*"analyze-company-profile"/);
  assert.match(task, /executeCompanyProfileAnalysis/);
  assert.match(service, /\.from\("ai_requests"\)/);
  assert.match(service, /\.from\("usage_ledger"\)/);
  assert.match(service, /save_clean_company_profile_version/);
  assert.doesNotMatch(service, /ai_generations|usage_events|research_tasks/);
});
