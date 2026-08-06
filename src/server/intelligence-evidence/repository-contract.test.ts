import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const evidenceRepository = readFileSync(
  "src/server/intelligence-evidence/evidence-repository.ts",
  "utf8",
);
const claimRepository = readFileSync(
  "src/server/intelligence-evidence/claim-repository.ts",
  "utf8",
);
const conflictRepository = readFileSync(
  "src/server/intelligence-evidence/conflict-repository.ts",
  "utf8",
);

test("repositories explicitly scope all reads and mutations to workspace", () => {
  assert.match(evidenceRepository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(claimRepository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(conflictRepository, /workspace_id: input\.workspaceId/);
  assert.match(conflictRepository, /\.eq\("workspace_id", input\.workspaceId\)/);
});

test("claim repository validates semantics and uses the atomic RPC", () => {
  assert.match(claimRepository, /intelligenceClaimSchema\.parse/);
  assert.match(claimRepository, /create_intelligence_claim_with_evidence/);
  assert.doesNotMatch(claimRepository, /\.from\("claim_evidence_links"\)\.insert/);
});

test("evidence input uses a discriminated source union", () => {
  assert.match(evidenceRepository, /kind: "company_source"/);
  assert.match(evidenceRepository, /kind: "document_chunk"/);
  assert.match(evidenceRepository, /kind: "provider_execution"/);
  assert.match(evidenceRepository, /kind: "manual"/);
});
