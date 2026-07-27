import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migration = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/20260727000600_fix_campaign_run_digest_search_path.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

test("Campaign Run RPC can resolve Supabase pgcrypto functions", () => {
  assert.match(
    migration,
    /alter function public\.create_clean_campaign_run\(uuid,\s*text,\s*integer\)/i,
  );
  assert.match(migration, /set search_path = public,\s*extensions/i);
});
