import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260726000100_allow_service_role_profile_version_save.sql",
    import.meta.url,
  ),
  "utf8",
);

test("background profile saves authorize service role while retaining admin checks", () => {
  assert.match(
    migration,
    /auth\.role\(\) <> 'service_role' and not public\.is_workspace_admin\(target_workspace_id\)/i,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_clean_company_profile_version\(uuid,jsonb,jsonb,jsonb,text\) to authenticated, service_role/i,
  );
});
