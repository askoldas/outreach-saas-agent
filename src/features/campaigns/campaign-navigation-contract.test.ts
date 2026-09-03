import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

test("campaign navigation exposes the locked product flow", async () => {
  const [shell, styles] = await Promise.all([
    read("./CampaignShell.tsx"),
    read("./CampaignShell.module.css"),
  ]);
  for (const label of [
    "Overview",
    "Strategy",
    "Company Research",
    "Companies",
    "Contacts",
    "Outreach",
  ]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(shell, /label: "Market Analysis"|label: "Discovery"/);
  assert.match(styles, /overflow-x:\s*auto/);
});

test("running campaigns expose outcome, pause, continue, and stop controls", async () => {
  const controls = await read("./CampaignControls.tsx");
  assert.match(controls, /targetCompanyCount/);
  assert.match(controls, /confirmed/);
  assert.doesNotMatch(controls, /Maximum research credits/);
  assert.doesNotMatch(controls, /Continue Research/);
  assert.match(controls, /Start Company Research/);
  assert.match(controls, /Stop campaign/);
  assert.match(controls, /currentStatus !== "running"/);
});

test("Company Research combines market, discovery, provenance, and usage", async () => {
  const [overview, research, history, summary, companies] = await Promise.all([
    read("../../app/(app)/campaigns/[id]/page.tsx"),
    read("../../app/(app)/campaigns/[id]/research/page.tsx"),
    read("./CampaignRunHistory.tsx"),
    read("./CampaignWorkflowSummary.tsx"),
    read("./ProgressiveCompanyResults.tsx"),
  ]);
  assert.doesNotMatch(overview, /redirect\(/);
  assert.match(research, /active="research"/);
  assert.match(research, /CampaignWorkflowSummary/);
  assert.match(overview, /ProgressiveCompanyResults/);
  assert.match(research, /ProgressiveCompanyResults/);
  assert.match(research, /ResearchLiveRefresh/);
  assert.doesNotMatch(research, /CampaignCandidateAudit/);
  assert.match(research, /CampaignRunTimeline/);
  assert.match(research, /InternalResearchUsage/);
  assert.match(history, /research\?run=/);
  assert.match(summary, /Market Overview/);
  assert.match(summary, /Adaptive research activity/);
  assert.match(companies, /resolved companies available while research continues/);
  assert.match(companies, /company\.websiteUrl/);
  assert.doesNotMatch(companies, /sourceUrl|sourceQuery/);
});
