import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const research = readFileSync(
  new URL("../research/repository.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const trigger = readFileSync(
  new URL("../../trigger/enrich-company-contacts.ts", import.meta.url),
  "utf8",
);

test("contact enrichment dispatches through Trigger.dev with clean execution state", () => {
  const section = research.slice(
    research.indexOf("export async function enqueueLeadContactEnrichmentRun"),
    research.indexOf("export async function enqueueCampaignDraftGenerationRun"),
  );
  assert.match(section, /\.from\("contact_enrichments"\)/);
  assert.match(section, /\.from\("provider_executions"\)/);
  assert.match(section, /dispatchProviderExecution/);
  assert.doesNotMatch(
    section,
    /research_runs|research_tasks|lead_outreach_states|\.from\("leads"\)/,
  );
  assert.match(trigger, /executeContactEnrichment/);
});

test("contact execution persists only clean contacts, provenance, and usage", () => {
  for (const table of [
    "campaign_companies",
    "contact_methods",
    "contact_sources",
    "campaign_contacts",
    "contact_enrichments",
    "provider_executions",
  ])
    assert.match(service, new RegExp(`\\.from\\("${table}"\\)`));
  assert.doesNotMatch(
    service,
    /lead_contact_routes|lead_outreach_states|usage_events|\.from\("leads"\)/,
  );
  assert.match(service, /settleContactEnrichmentCredits/);
  assert.match(service, /searchWebResult/);
});

test("contact enrichment has explicit authorization separate from research credits", () => {
  assert.match(research, /authorizeContactEnrichmentCredits/);
  assert.match(research, /contactCreditAuthorizationId/);
  assert.match(research, /creditCap/);
});
