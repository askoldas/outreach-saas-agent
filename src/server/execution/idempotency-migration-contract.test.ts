import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const providerMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260727000100_provider_result_idempotency.sql",
    import.meta.url,
  ),
  "utf8",
);
const draftService = readFileSync(
  new URL("../draft-generation/service.ts", import.meta.url),
  "utf8",
);

test("logical provider operations and completed AI audit records are unique", () => {
  assert.match(providerMigration, /unique \(workspace_id, operation, idempotency_key\)/i);
  assert.match(
    providerMigration,
    /ai_requests\(provider_execution_id, role, request_hash, status\)/i,
  );
});

test("outreach drafts cache paid output before domain persistence", () => {
  assert.match(draftService, /loadProviderResult/);
  assert.match(draftService, /storeProviderResult/);
  assert.ok(
    draftService.indexOf("storeProviderResult") <
      draftService.indexOf('.from("outreach_drafts")'),
  );
});
