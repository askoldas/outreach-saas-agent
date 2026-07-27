import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");

test("draft reads use the clean outreach schema", () => {
  assert.match(repository, /campaign:campaigns!inner \(external_id\)/);
  assert.match(repository, /campaign_company_id/);
  assert.match(repository, /campaign_contact:campaign_contacts/);
  assert.match(repository, /\.eq\("id", draftId\)/);
  assert.doesNotMatch(
    repository,
    /\b(external_id,\s*lead_external_id|campaign_external_id|recipient_route|last_edited_label)\b/,
  );
});
