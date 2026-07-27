import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const research = readFileSync(
  new URL("../research/repository.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const trigger = readFileSync(
  new URL("../../trigger/discover-campaign-companies.ts", import.meta.url),
  "utf8",
);

test("Campaign discovery creates a clean run and dispatches Trigger.dev", () => {
  const section = research.slice(
    research.indexOf("export async function enqueueCampaignDiscoveryRun"),
    research.indexOf("export async function enqueueLeadContactEnrichmentRun"),
  );
  assert.match(section, /create_clean_campaign_run/);
  assert.match(section, /\.from\("provider_executions"\)/);
  assert.match(section, /tasks\.trigger<typeof executeCampaignTask>/);
  assert.match(section, /"execute-campaign"/);
  assert.match(section, /trigger_run_id: handle\.id/);
  assert.doesNotMatch(section, /research_runs|research_tasks/);
  assert.match(trigger, /executeCampaignDiscovery/);
});

test("discovery and qualification persist only clean durable entities", () => {
  for (const table of [
    "campaign_runs",
    "campaign_run_events",
    "companies",
    "company_domains",
    "company_sources",
    "campaign_companies",
    "qualification_results",
    "qualification_dimensions",
    "qualification_evidence",
    "ai_requests",
    "usage_ledger",
    "market_analyses",
    "discovery_plans",
    "discovery_paths",
    "discovery_iterations",
    "discovery_queries",
    "discovery_candidates",
    "candidate_classifications",
  ])
    assert.match(service, new RegExp(`\\.from\\("${table}"\\)`));
  assert.match(service, /evaluateLeadSourceWithAi/);
  assert.match(service, /preferred_outreach_language/);
  assert.match(service, /snapshot_data/);
  assert.match(service, /strategyDocument = asRecord\(strategy\.strategy\)/);
  assert.match(service, /strategyDocument\.searchLanguages/);
  assert.match(service, /discoveryLanguages: stringArray/);
  assert.doesNotMatch(
    service,
    /discoveryLanguages:\s*\[?campaignRow\.preferred_outreach_language/,
  );
  assert.doesNotMatch(service, /\.select\("snapshot"\)/);
  assert.doesNotMatch(service, /strategy\.search_languages/);
  assert.doesNotMatch(service, /objective,language\)/);
  assert.match(service, /ready_for_review/);
  assert.doesNotMatch(
    service,
    /research_runs|research_tasks|lead_sources|ai_generations|usage_events|\.from\("leads"\)/,
  );
});
