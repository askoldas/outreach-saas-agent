import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations-legacy/20260719000400_add_grounded_draft_generation.sql",
    import.meta.url,
  ),
  "utf8",
);

test("draft generation migration freezes grounding references", () => {
  assert.match(
    migration,
    /company_profile_version_id uuid references public\.company_profile_versions/i,
  );
  assert.match(
    migration,
    /strategy_version_id uuid references public\.campaign_strategy_versions/i,
  );
  assert.match(migration, /generation_task_id uuid references public\.research_tasks/i);
  assert.match(migration, /unique index outreach_drafts_campaign_lead_variant_idx/i);
});
