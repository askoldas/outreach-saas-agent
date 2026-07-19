import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contact enrichment migration persists provider verification provenance", async () => {
  const sql = await readFile(
    new URL(
      "../../../supabase/migrations/20260719000900_add_contact_verification_provenance.sql",
      import.meta.url,
    ),
    "utf8",
  );

  for (const column of [
    "verification_provider",
    "verification_query",
    "verification_source_title",
    "verification_source_url",
    "verified_at",
  ]) {
    assert.match(sql, new RegExp(`add column ${column}`));
  }
});
