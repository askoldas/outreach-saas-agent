import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignSearchQueries } from "./query-builder.ts";
import type { Campaign } from "../../types/domain.ts";

test("Lithuanian discovery includes local and international terminology", () => {
  const campaign: Campaign = {
    id: "campaign",
    name: "Lithuanian suppliers",
    objective: "Find pharmaceutical distributors",
    geography: "Lithuania",
    industryTerms: ["pharmaceutical"],
    targetSegments: ["distributor"],
    progress: 0,
    leadCount: 0,
    desiredLeadCount: 25,
    awaitingReview: 0,
    status: "planning",
    lastActivity: "",
    preferredOutreachLanguage: "English",
    discoveryLanguages: ["Lithuanian", "English"],
    warnings: [],
    latestDiscoveryReport: null,
    strategy: {
      terms: ["pharmaceutical distributor"],
      localizedTerms: [],
      sources: ["Company websites"],
      criteria: [],
      exclusions: [],
      limitations: [],
    },
  };

  const queries = buildCampaignSearchQueries(campaign);
  assert.ok(queries.some((query) => /įmonė|tiekėjas|kontaktai/.test(query)));
  assert.ok(queries.some((query) => /company|provider|supplier|contact/i.test(query)));
  assert.equal(campaign.preferredOutreachLanguage, "English");
});
