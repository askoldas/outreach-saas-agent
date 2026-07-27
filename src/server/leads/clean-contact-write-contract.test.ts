import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leads = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const outreach = readFileSync(
  new URL("../outreach/repository.ts", import.meta.url),
  "utf8",
);

test("contact enrichment persists reusable methods, provenance, and Campaign contacts", () => {
  const section = leads.slice(
    leads.indexOf("export async function replaceLeadContactRoutes"),
  );
  assert.match(section, /\.from\("contact_methods"\)/);
  assert.match(section, /\.from\("contact_sources"\)/);
  assert.match(section, /\.from\("campaign_contacts"\)/);
  assert.doesNotMatch(section, /lead_contact_routes|\.from\("leads"\)/);
});

test("recipient selection updates Campaign contacts instead of legacy outreach state", () => {
  const section = outreach.slice(
    outreach.indexOf("export async function saveRecipientSelection"),
    outreach.indexOf("export async function createExportRecord"),
  );
  assert.match(section, /\.from\("campaign_companies"\)/);
  assert.match(section, /\.from\("campaign_contacts"\)/);
  assert.match(section, /selection_status: "selected"/);
  assert.doesNotMatch(section, /lead_outreach_states|\.from\("leads"\)/);
});
