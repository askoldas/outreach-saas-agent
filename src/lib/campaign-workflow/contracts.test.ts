import assert from "node:assert/strict";
import test from "node:test";
import { parseCampaignBriefProposal, parseConfirmedCampaignBrief } from "./contracts.ts";

const valid = {
  geography: { countryCodes: ["DE"], regionLabel: "Germany", primaryLanguage: "German" },
  offering: {
    profileOfferingIds: ["offering-1"],
    title: "Lead intelligence",
    summary: "Evidence-backed company discovery",
    valueProposition: "Reduce wasted prospect research",
    rationale: "The selected market has a suitable buyer segment.",
  },
  targetClient: {
    companyTypes: ["B2B agency"],
    industries: ["Software"],
    employeeRange: { min: 10, max: 100 },
    characteristics: ["Runs outbound sales"],
    positiveSignals: ["Lead generation service"],
    requiredCriteria: ["Operates in Germany"],
    exclusions: ["Freelancers"],
    recommendedDecisionMakerRoles: ["Founder"],
    summary: "German B2B software agencies running outbound sales.",
  },
  ambiguity: { requiresClarification: false },
  confidence: 0.84,
};

test("campaign brief proposal is structured and references a frozen profile offering", () => {
  const result = parseCampaignBriefProposal(valid, new Set(["offering-1"]));
  assert.deepEqual(result.geography.countryCodes, ["DE"]);
  assert.equal(result.targetClient.employeeRange?.max, 100);
});

test("campaign brief proposal preserves validated stale-input provenance", () => {
  const provenance = {
    objective: "direct_buyer",
    selectedOfferingKey: "offering-1",
    selectedOfferingVersionId: "offering-version-1",
    profileVersionId: "profile-version-1",
    promptVersion: "campaign-brief-proposal-v4-objective-first",
    inputHash: "a".repeat(64),
  };
  const result = parseCampaignBriefProposal(
    { ...valid, provenance },
    new Set(["offering-1"]),
  );
  assert.deepEqual(result.provenance, provenance);
});

test("campaign brief rejects an offering absent from the Company Profile", () => {
  assert.throws(
    () => parseCampaignBriefProposal(valid, new Set(["other-offering"])),
    /exactly one known Company Profile offering/,
  );
});

test("campaign brief rejects malformed target client output", () => {
  assert.throws(
    () =>
      parseCampaignBriefProposal(
        { ...valid, targetClient: { ...valid.targetClient, exclusions: "none" } },
        new Set(["offering-1"]),
      ),
    /targetClient.exclusions/,
  );
});

test("campaign brief cannot require an invisible clarification", () => {
  const result = parseCampaignBriefProposal(
    {
      ...valid,
      ambiguity: { requiresClarification: true },
    },
    new Set(["offering-1"]),
  );
  assert.equal(result.ambiguity?.requiresClarification, false);
});

test("confirmed campaign brief requires one primary profile offering", () => {
  assert.throws(
    () =>
      parseConfirmedCampaignBrief(
        {
          geography: valid.geography,
          offering: {
            ...valid.offering,
            profileOfferingIds: ["offering-1", "offering-2"],
          },
          targetClient: valid.targetClient,
          desiredQualifiedCompanies: 50,
        },
        new Set(["offering-1", "offering-2"]),
      ),
    /exactly one known Company Profile offering/,
  );
});

test("confirmed campaign brief rejects unknown offerings and invalid volume", () => {
  const brief = {
    geography: valid.geography,
    offering: valid.offering,
    targetClient: valid.targetClient,
    desiredQualifiedCompanies: 25,
  };
  assert.throws(
    () =>
      parseConfirmedCampaignBrief(
        { ...brief, offering: { ...valid.offering, profileOfferingIds: ["unknown"] } },
        new Set(["offering-1"]),
      ),
    /exactly one known Company Profile offering/,
  );
  assert.throws(
    () =>
      parseConfirmedCampaignBrief(
        { ...brief, desiredQualifiedCompanies: 501 },
        new Set(["offering-1"]),
      ),
    /desiredQualifiedCompanies/,
  );
});

test("confirmed campaign brief rejects an inverted employee range", () => {
  assert.throws(
    () =>
      parseConfirmedCampaignBrief(
        {
          geography: valid.geography,
          offering: valid.offering,
          targetClient: {
            ...valid.targetClient,
            employeeRange: { min: 100, max: 10 },
          },
          desiredQualifiedCompanies: 25,
        },
        new Set(["offering-1"]),
      ),
    /invalid employee range/,
  );
});

test("confirmed brief enforces objective and relationship compatibility", () => {
  assert.throws(
    () =>
      parseConfirmedCampaignBrief(
        {
          ...valid,
          targetSegments: [
            {
              id: "supplier-segment",
              name: "Suppliers",
              summary: "Organizations supplying an input.",
              relationshipType: "supplier",
              organizationTypes: ["Supplier"],
              industries: [],
              geographies: ["DE"],
              characteristics: [],
              buyingSignals: [],
              likelyBuyerRoles: [],
              exclusions: [],
              rationale: "Supplier sourcing",
              supportingEvidence: [],
              discoverability: "medium",
              source: "user_added",
              confidence: "medium",
              status: "confirmed",
            },
          ],
          desiredQualifiedCompanies: 25,
        },
        new Set(["offering-1"]),
        "direct_buyer",
      ),
    /incompatible.*supplier/,
  );
});
