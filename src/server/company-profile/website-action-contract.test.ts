import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("company website updates preserve the current profile as a new version", async () => {
  const actions = await readFile(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(actions, /export async function updateCompanyWebsiteAction/);
  assert.match(actions, /const currentProfile = await getCurrentCompanyProfile/);
  assert.match(actions, /\.\.\.currentProfile,[\s\S]*id: null,[\s\S]*website,/);
  assert.match(
    actions,
    /redirect\("\/company-profile\?message=company-website-updated"\)/,
  );
});

test("company profile UI distinguishes its analysis URL from supporting sources", async () => {
  const settings = await readFile(
    new URL("../../features/company-profile/CompanyWebsiteSettings.tsx", import.meta.url),
    "utf8",
  );
  assert.match(settings, /Website analysis uses this URL/);
  assert.match(settings, /Sources and materials/);
  assert.match(settings, /updateCompanyWebsiteAction/);
});
