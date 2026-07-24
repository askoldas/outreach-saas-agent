import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public routes stay public while application routes require authentication", async () => {
  const proxy = await readFile(
    new URL("../../lib/supabase/proxy.ts", import.meta.url),
    "utf8",
  );
  assert.match(proxy, /const authRoutes = new Set\(\["\/login", "\/signup"\]\)/);
  for (const route of [
    "dashboard",
    "campaigns",
    "company-profile",
    "leads",
    "sequences",
    "settings",
  ]) {
    assert.match(proxy, new RegExp(`"/${route}"`));
  }
  assert.doesNotMatch(proxy, /protectedPrefixes[\s\S]*"\/product"/);
  assert.match(proxy, /redirectUrl\.pathname = "\/login"/);
});

test("authenticated navigation uses Campaigns as its landing destination", async () => {
  const shell = await readFile(
    new URL("../../components/layout/AppShell.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = await readFile(
    new URL("../../app/(app)/dashboard/page.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(shell, /label: "Dashboard"/);
  assert.match(shell, /href="\/campaigns"/);
  assert.match(shell, /label: "Your Company"/);
  assert.match(shell, /label: "Leads"/);
  assert.match(shell, /label: "Sequences"/);
  assert.match(dashboard, /redirect\("\/campaigns"\)/);
});

test("root layout exposes the intercepted authentication modal slot", async () => {
  const layout = await readFile(new URL("../../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /modal: React\.ReactNode/);
  assert.match(layout, /\{modal\}/);
});
