import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("discovery progress reads canonical company, qualification, and contact state", () => {
  const section = repository.slice(
    repository.indexOf("export async function getCampaignDiscoveryProgress"),
    repository.indexOf("export async function importRawDiscoveredLeads"),
  );
  assert.match(section, /\.from\("campaign_companies"\)/);
  assert.match(section, /qualification_results/);
  assert.match(section, /campaign_contacts/);
  assert.doesNotMatch(section, /\.from\("leads"\)|lead_contact_routes/);
});

test("raw discovery persistence writes reusable companies and campaign associations", () => {
  const section = repository.slice(
    repository.indexOf("export async function importRawDiscoveredLeads"),
    repository.indexOf("export async function applyLeadQualification"),
  );
  assert.match(section, /\.from\("companies"\)/);
  assert.match(section, /\.from\("company_domains"\)/);
  assert.match(section, /\.from\("company_sources"\)/);
  assert.match(section, /\.from\("campaign_companies"\)/);
  assert.doesNotMatch(section, /lead_evidence_claims|\.from\("leads"\)/);
});
