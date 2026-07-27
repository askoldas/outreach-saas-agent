import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = source(
  "supabase/migrations/20260728001900_allow_service_role_workspace_admin.sql",
);
const coverage = source("src/server/discovery-v2/coverage-repository.ts");
const provider = source("src/server/discovery-v2/provider-repository.ts");

test("trusted workers can use admin-scoped RPCs without weakening user checks", () => {
  assert.match(migration, /auth\.role\(\) = 'service_role' or exists/);
  assert.match(migration, /user_id = auth\.uid\(\)/);
  assert.match(migration, /role in \('owner', 'admin'\)/);
  assert.match(migration, /grant execute[\s\S]+authenticated, service_role/);
});

test("background discovery persistence uses the service-role client", () => {
  for (const repository of [coverage, provider]) {
    assert.match(repository, /createServiceRoleClient/);
    assert.doesNotMatch(repository, /createAuthenticatedDatabaseClient/);
  }
});
