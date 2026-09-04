import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/server/company-profile-v3/source-service.ts", "utf8");
const stage = readFileSync("src/server/company-profile-v3/stage-service.ts", "utf8");
const actions = readFileSync("src/server/company-profile-v3/actions.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260904001200_company_profile_page_cache.sql", "utf8");

test("profile crawl is selective, bounded, cached by content and version, and forceable", () => {
  assert.match(source, /maximumPages = 5/);
  assert.match(source, /isCommerciallyUsefulUrl/);
  assert.match(source, /content_hash/);
  assert.match(source, /extractorVersion/);
  assert.match(source, /cacheHits/);
  assert.match(actions, /forceRefresh: true/);
  assert.match(migration, /unique\(workspace_id,url,content_hash,extractor_version\)/);
});

test("active Company Intelligence uses one whole-company synthesis call", () => {
  assert.doesNotMatch(stage, /buyerLogicShardContexts|shards\.map/);
  assert.match(stage, /profileV3StageIds = \["profile\.whole_company_analysis"\]/);
  assert.match(stage, /return generateSingleValidatedProfileStageOutput\(input\)/);
});
