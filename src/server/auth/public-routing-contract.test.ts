import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public routes stay public while application routes require authentication", async () => {
  const proxy = await readFile(
    new URL("../../lib/supabase/proxy.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxy, /const authRoutes = new Set\(\["\/login", "\/signup"\]\)/);
  for (const route of ["dashboard", "campaigns", "company-profile", "settings"]) {
    assert.match(proxy, new RegExp(`"/${route}"`));
  }
  assert.doesNotMatch(proxy, /protectedPrefixes[\s\S]*"\/product"/);
  assert.match(proxy, /redirectUrl\.pathname = "\/login"/);
});

test("root layout exposes the intercepted authentication modal slot", async () => {
  const layout = await readFile(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /modal: React\.ReactNode/);
  assert.match(layout, /\{modal\}/);
});
