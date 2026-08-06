import assert from "node:assert/strict";
import test from "node:test";
import {
  createNativeCompanyProfileSeed,
  readNativeCompanyProfileSourceSet,
} from "./native-source.ts";

test("native Company Intelligence seed is stable V3 identity plus official website", () => {
  const seed = createNativeCompanyProfileSeed({
    companyProfileId: "11111111-1111-4111-8111-111111111111",
    publicName: "Example Company",
    websiteUrl: "example.com/about#team",
    workspaceId: "22222222-2222-4222-8222-222222222222",
  });

  assert.equal(seed.schemaVersion, 3);
  assert.equal(seed.status, "draft");
  assert.equal(seed.identity.publicName, "Example Company");
  assert.equal(seed.identity.canonicalDomain, "example.com");
  assert.equal(seed.sourceSet.kind, "official_website");
  assert.equal(seed.sourceSet.primaryWebsiteUrl, "https://example.com/about");
  assert.deepEqual(seed.offerings, []);
  assert.deepEqual(seed.buyerArchetypes, []);
});

test("native source reader rejects non-native adapter snapshots", () => {
  assert.throws(
    () => readNativeCompanyProfileSourceSet({ sourceSet: { kind: "legacy_adapter" } }),
    /invalid_type|Invalid input/i,
  );
});
