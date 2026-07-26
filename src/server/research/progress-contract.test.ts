import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Company Profile progress is authenticated and workspace scoped", async () => {
  const route = await readFile(
    new URL("../../app/api/company-profile/analysis-progress/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /getWorkspaceContext/);
  assert.match(route, /workspaceId: currentWorkspace\.id/);
  assert.match(route, /campaignId: "company-profile"/);
  assert.match(route, /Cache-Control.*no-store/s);

  const repository = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  assert.match(repository, /\.from\("provider_executions"\)/);
  assert.match(repository, /\.eq\("operation", "company_profile_analysis"\)/);
});

test("shared progress panel polls only active durable runs", async () => {
  const panel = await readFile(
    new URL("../../features/progress/RunProgressPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /status === "pending"/);
  assert.match(panel, /status === "running"/);
  assert.match(panel, /setInterval/);
});
