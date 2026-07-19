import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("historical export download is workspace scoped and non-cacheable", async () => {
  const route = await readFile(
    new URL("../../app/api/exports/[id]/download/route.ts", import.meta.url),
    "utf8",
  );
  const repository = await readFile(new URL("./repository.ts", import.meta.url), "utf8");
  assert.match(route, /getWorkspaceContext/);
  assert.match(route, /getExportRecord\(currentWorkspace\.id, id\)/);
  assert.match(route, /private, no-store/);
  assert.match(repository, /\.eq\("workspace_id", workspaceId\)/);
  assert.match(repository, /\.eq\("id", exportId\)/);
});
