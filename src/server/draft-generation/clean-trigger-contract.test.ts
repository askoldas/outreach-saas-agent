import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const research = readFileSync(
  new URL("../research/repository.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
const trigger = readFileSync(
  new URL("../../trigger/generate-outreach-draft.ts", import.meta.url),
  "utf8",
);

test("draft generation dispatches selected clean Campaign contacts through Trigger", () => {
  const section = research.slice(
    research.indexOf("export async function enqueueCampaignDraftGenerationRun"),
    research.indexOf("export async function enqueueCompanyProfileAnalysisRun"),
  );
  assert.match(section, /\.from\("campaign_contacts"\)/);
  assert.match(section, /\.from\("provider_executions"\)/);
  assert.match(section, /tasks\.trigger<typeof generateOutreachDraftTask>/);
  assert.doesNotMatch(
    section,
    /research_runs|research_tasks|lead_outreach_states|\.from\("leads"\)/,
  );
  assert.match(trigger, /executeDraftGeneration/);
});

test("draft execution writes clean drafts, AI audit, state, and usage", () => {
  for (const table of [
    "outreach_drafts",
    "ai_requests",
    "campaign_companies",
    "provider_executions",
    "usage_ledger",
  ])
    assert.match(service, new RegExp(`\\.from\\("${table}"\\)`));
  assert.match(service, /campaign_company_id: campaignCompanyId/);
  assert.match(service, /campaign_contact_id: campaignContactId/);
  assert.match(service, /profile_snapshot_id: profileSnapshotId/);
  assert.match(service, /input_hash: requestHash/);
  assert.doesNotMatch(
    service,
    /ai_generations|usage_events|lead_contact_routes|\.from\("leads"\)/,
  );
});
