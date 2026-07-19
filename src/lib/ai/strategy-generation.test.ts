import assert from "node:assert/strict";
import test from "node:test";
import { parseCampaignStrategy } from "./strategy-generation.ts";

const arrays = {
  companyTypes: [],
  industries: [],
  characteristics: [],
  relevanceReasons: [],
  opportunityAssumptions: [],
  qualificationCriteria: [],
  positiveSignals: [],
  exclusions: [],
  contactRoles: [],
  contactDepartments: [],
  acceptableContactRoutes: [],
  searchLanguages: [],
  sourceCategories: [],
  searchTerms: [],
  localizedTerms: [],
  limitations: [],
  refinementSummary: [],
};

test("parses a complete structured AI Strategy", () => {
  const strategy = parseCampaignStrategy(
    JSON.stringify({
      targetGeography: "Northern Europe",
      targetCompanyCount: 25,
      ...arrays,
    }),
  );
  assert.equal(strategy.targetGeography, "Northern Europe");
  assert.equal(strategy.status, "ready");
});

test("rejects incomplete AI Strategy output", () => {
  assert.throws(
    () => parseCampaignStrategy('{"targetGeography":"Italy"}'),
    /invalid companyTypes/,
  );
});
