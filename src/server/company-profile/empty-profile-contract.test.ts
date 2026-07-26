import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const repository = readFileSync(new URL("./repository.ts", import.meta.url), "utf8");
const page = readFileSync(
  new URL("../../app/(app)/company-profile/page.tsx", import.meta.url),
  "utf8",
);

test("a new workspace renders an empty Company Profile before its first version", () => {
  assert.match(repository, /if \(!profile\.current_version_id\)/);
  assert.match(
    repository,
    /return emptyProfile\(workspace\.name, workspace\.website_url\)/,
  );
  assert.match(repository, /structuredProfile: null/);
  assert.doesNotMatch(page, /Company Profile is missing\. Apply the ordered profile/);
});
