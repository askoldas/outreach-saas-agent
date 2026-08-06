import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shellUrl = new URL("./CampaignShell.tsx", import.meta.url);
const shellStylesUrl = new URL("./CampaignShell.module.css", import.meta.url);
const overviewUrl = new URL("../../app/(app)/campaigns/[id]/page.tsx", import.meta.url);
const marketUrl = new URL(
  "../../app/(app)/campaigns/[id]/market-analysis/page.tsx",
  import.meta.url,
);
const discoveryUrl = new URL(
  "../../app/(app)/campaigns/[id]/discovery/page.tsx",
  import.meta.url,
);
const controlsUrl = new URL("./CampaignControls.tsx", import.meta.url);
const runOverviewUrl = new URL("./CampaignRunOverview.tsx", import.meta.url);
const runHistoryUrl = new URL("./CampaignRunHistory.tsx", import.meta.url);
const candidateAuditUrl = new URL("./CampaignCandidateAudit.tsx", import.meta.url);
const workflowRepositoryUrl = new URL(
  "../../server/campaigns/workflow-repository.ts",
  import.meta.url,
);
const runTimelineUrl = new URL("./CampaignRunTimeline.tsx", import.meta.url);

test("campaign navigation exposes the canonical product sections", async () => {
  const [shell, styles] = await Promise.all([
    readFile(shellUrl, "utf8"),
    readFile(shellStylesUrl, "utf8"),
  ]);
  for (const label of [
    "Overview",
    "Market Analysis",
    "Strategy",
    "Discovery",
    "Companies",
    "Contacts",
    "Outreach",
  ]) {
    assert.match(shell, new RegExp(`label: "${label}"`));
  }
  assert.match(styles, /overflow-x:\s*auto/);
});

test("running campaigns retain functional pause and stop controls", async () => {
  const controls = await readFile(controlsUrl, "utf8");
  assert.match(controls, /currentStatus !== "running"/);
  assert.match(controls, /currentStatus !== "paused"/);
  assert.match(controls, /Stop campaign/);
  assert.match(controls, /Completed discovery results will be preserved/);
  assert.doesNotMatch(controls, /disabled=\{isBusy\}/);
});

test("campaign root is a real overview and stage artifacts have dedicated pages", async () => {
  const [
    overview,
    market,
    discovery,
    runOverview,
    runHistory,
    candidateAudit,
    workflowRepository,
    runTimeline,
  ] = await Promise.all([
    readFile(overviewUrl, "utf8"),
    readFile(marketUrl, "utf8"),
    readFile(discoveryUrl, "utf8"),
    readFile(runOverviewUrl, "utf8"),
    readFile(runHistoryUrl, "utf8"),
    readFile(candidateAuditUrl, "utf8"),
    readFile(workflowRepositoryUrl, "utf8"),
    readFile(runTimelineUrl, "utf8"),
  ]);
  assert.doesNotMatch(overview, /redirect\(/);
  assert.match(overview, /active="overview"/);
  assert.match(overview, /CampaignControls/);
  assert.match(overview, /candidatesDiscovered/);
  assert.match(overview, /CampaignRunOverview/);
  assert.match(overview, /CampaignRunHistory/);
  assert.match(overview, /CampaignRunTimeline/);
  assert.match(overview, /CampaignClarification/);
  assert.match(runOverview, /Run cost/);
  assert.match(runOverview, /Next action/);
  assert.match(runOverview, /Run blocker/);
  assert.match(runHistory, /Campaign run history/);
  assert.match(runHistory, /companiesQualified/);
  assert.match(runHistory, /totalCost/);
  assert.match(runHistory, /market-analysis\?run=/);
  assert.match(runHistory, /discovery\?run=/);
  assert.match(market, /active="market"/);
  assert.match(market, /view="market"/);
  assert.match(market, /Adjust market and targeting/);
  assert.match(market, /new\s+immutable Campaign Strategy version/);
  assert.match(discovery, /active="discovery"/);
  assert.match(discovery, /view="discovery"/);
  assert.match(discovery, /CampaignCandidateAudit/);
  assert.match(discovery, /CampaignRunTimeline/);
  assert.match(workflowRepository, /campaign_strategy_versions/);
  assert.match(workflowRepository, /discovery_plans_v2/);
  assert.match(workflowRepository, /discovery_segments_v2/);
  assert.match(workflowRepository, /discovery_query_plans_v2/);
  assert.match(candidateAudit, /Raw candidate audit/);
  assert.match(candidateAudit, /sourceQuery/);
  assert.match(candidateAudit, /shouldEvaluate/);
  assert.match(market, /searchParams: Promise<\{ run\?: string \}>/);
  assert.match(discovery, /searchParams: Promise<\{ run\?: string \}>/);
  assert.match(
    workflowRepository,
    /runs\.find\(\(item\) => item\.id === selectedRunId\)/,
  );
  assert.match(workflowRepository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(workflowRepository, /\.eq\("visible_to_user", true\)/);
  assert.match(runTimeline, /Run timeline/);
  assert.match(runTimeline, /eventType/);
});
