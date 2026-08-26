import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(
  "src/server/core-intelligence-v2/commercial-intelligence-service.ts",
  "utf8",
);
const repository = readFileSync("src/server/core-intelligence-v2/repository.ts", "utf8");

test("Commercial Intelligence compiles from the exact published native V3 row", () => {
  assert.match(service, /\.from\("company_profiles"\)/);
  assert.match(service, /\.select\("current_version_id"\)/);
  assert.match(service, /\.from\("company_profile_versions"\)/);
  assert.match(service, /version\.intelligence_version !== "v2"/);
  assert.match(service, /version\.profile_status !== "published"/);
  assert.match(service, /companyIntelligenceV3Schema\.parse/);
  assert.match(service, /parsed\.profileVersionId !== version\.id/);
  assert.match(service, /parsed\.identity\.workspaceId !== workspaceId/);
});

test("Commercial Intelligence persistence reuses frozen input identity", () => {
  assert.match(service, /compileCommercialIntelligence/);
  assert.match(service, /loadLatestCommercialIntelligenceVersionNumber/);
  assert.match(service, /persistCommercialIntelligence/);
  assert.match(repository, /commercial_intelligence_versions_v2/);
  assert.match(repository, /\.eq\("input_hash", input\.artifact\.version\.inputHash\)/);
  assert.match(repository, /inserted\.error\.code === "23505"/);
});
