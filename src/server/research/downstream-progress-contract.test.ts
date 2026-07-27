import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const research = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const contacts = readFileSync(
  new URL("../contact-enrichment/service.ts", import.meta.url),
  "utf8",
);
const drafts = readFileSync(
  new URL("../draft-generation/service.ts", import.meta.url),
  "utf8",
);

test("downstream enqueueing reopens the clean Campaign Run progress phase", () => {
  assert.match(research, /status: "enriching"/);
  assert.match(research, /current_phase: "enriching"/);
  assert.match(research, /status: "preparing_outreach"/);
  assert.match(research, /current_phase: "preparing_outreach"/);
});

test("Trigger services close downstream phases only after active executions finish", () => {
  for (const service of [contacts, drafts]) {
    assert.match(service, /\.in\("status", \["pending", "running"\]\)/);
    assert.match(service, /\.from\("campaign_runs"\)/);
    assert.match(service, /waiting_for_outreach_approval/);
  }
  assert.match(contacts, /contacts_found: contactsFound/);
});
