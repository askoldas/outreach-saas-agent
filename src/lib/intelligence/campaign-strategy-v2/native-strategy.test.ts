import assert from "node:assert/strict";
import test from "node:test";
import type { ConfirmedCampaignBrief } from "@/lib/campaign-workflow/contracts";
import type { CampaignPlanningOffering } from "./planning-profile.ts";
import { buildNativeCampaignStrategyV2 } from "./native-strategy.ts";

test("native strategy creation compiles confirmed campaign intent without a V1 import", () => {
  const strategy = buildNativeCampaignStrategyV2({
    campaignId: "campaign-1",
    strategyDraftId: "draft-1",
    profileVersionId: "profile-version-1",
    offering: offering(),
    confirmedBrief: brief(),
    objectiveCode: "direct_buyer",
    geography: {
      mode: "country",
      displayName: "Lithuania",
      countryCodes: ["LT"],
      includedRegions: [],
      includedCities: [],
      excludedRegions: [],
      excludedCities: [],
      localLanguages: [],
      workingLanguages: ["English"],
      userConfirmed: true,
    },
    applicableProfileRules: [],
  });

  assert.equal(strategy.creationContract, "native-campaign-strategy/v1");
  assert.equal(strategy.legacyImport, undefined);
  assert.equal(strategy.offeringReferences[0]?.offeringVersionId, "offering-version-1");
  assert.equal(strategy.archetypes[0]?.label, "Hospital procurement teams");
  assert.equal(strategy.discoverySegments[0]?.relationshipType, "direct_buyer");
  assert.equal(strategy.qualificationPolicy.factorDefinitions.length, 4);
  assert.equal(
    strategy.qualificationPolicy.factorDefinitions.some(
      ({ factorKey }) => factorKey === "target_geography",
    ),
    true,
  );
  assert.equal(
    strategy.qualificationPolicy.minimumEvidenceRequirements.some(
      ({ questionKey }) => questionKey === "target_geography",
    ),
    true,
  );
  assert.equal(
    strategy.qualificationPolicy.factorDefinitions.reduce(
      (total, factor) => total + factor.weight,
      0,
    ),
    100,
  );
});

test("native strategy accepts an explicitly selected worldwide market", () => {
  const confirmedBrief = brief();
  confirmedBrief.geography = {
    countryCodes: ["WORLDWIDE"],
    regionLabel: "Worldwide",
    primaryLanguage: "English",
  };
  const strategy = buildNativeCampaignStrategyV2({
    campaignId: "campaign-2",
    strategyDraftId: "draft-2",
    profileVersionId: "profile-version-1",
    offering: offering(),
    confirmedBrief,
    objectiveCode: "direct_buyer",
    geography: {
      mode: "country",
      displayName: "Worldwide",
      countryCodes: ["WORLDWIDE"],
      includedRegions: [],
      includedCities: [],
      excludedRegions: [],
      excludedCities: [],
      localLanguages: [],
      workingLanguages: ["English"],
      userConfirmed: true,
    },
    applicableProfileRules: [],
  });
  assert.deepEqual(strategy.geography.countryCodes, ["WORLDWIDE"]);
});

function offering(): CampaignPlanningOffering {
  return {
    stableKey: "generic-prescription-portfolio",
    offeringId: "offering-1",
    offeringVersionId: "offering-version-1",
    slug: "generic-prescription-portfolio",
    name: "Generic prescription portfolio",
    offeringType: "physical_product",
    shortDescription: "A portfolio of prescription generic medicines.",
    confidence: 0.84,
    commercialMechanics: {
      buyingMotion: "procurement_led",
      customerConsumptionMode: "own_use",
      dependencies: [],
      valueProposition: ["Reliable access to generic medicines"],
      customerProblems: ["Supply continuity"],
      expectedOutcomes: ["Stable medicine availability"],
      transactionModels: ["tender"],
    },
    buyerLogic: {
      whyBuy: ["Maintain medicine availability"],
      requiredConditions: ["Procures prescription medicines"],
      preferredConditions: ["Runs formal tenders"],
      likelyTriggers: ["Upcoming procurement cycle"],
      incompatibleConditions: ["Does not purchase medicines"],
    },
    relationshipOptions: [
      {
        relationshipType: "direct_buyer",
        relevance: "primary",
        rationale: "Hospitals procure medicines for patient care.",
        confidence: 0.86,
      },
    ],
    archetypes: [
      {
        key: "hospital-procurement",
        name: "Hospital procurement teams",
        relationshipType: "direct_buyer",
        priority: "priority",
        status: "user_confirmed",
        description: "Hospitals with institutional medicine procurement.",
        whyCompatible: ["They purchase medicines for clinical use."],
        requiredEvidence: ["Evidence of a pharmacy or procurement function"],
        positiveSignals: ["Publishes medicine tenders"],
        negativeSignals: ["No medicine procurement"],
        likelyDecisionRoles: ["Procurement director", "Chief pharmacist"],
        confidence: 0.86,
        evidenceIds: [],
      },
    ],
  };
}

function brief(): ConfirmedCampaignBrief {
  return {
    geography: {
      countryCodes: ["LT"],
      regionLabel: "Lithuania",
      primaryLanguage: "English",
    },
    offering: {
      profileOfferingIds: ["generic-prescription-portfolio"],
      title: "Generic prescription portfolio",
      summary: "Prescription generic medicines.",
      valueProposition: "Reliable access to generic medicines.",
      rationale: "Selected from the published Company Profile.",
    },
    targetClient: {
      companyTypes: ["Hospitals"],
      industries: ["Healthcare"],
      characteristics: ["Institutional procurement"],
      positiveSignals: ["Publishes medicine tenders"],
      requiredCriteria: ["Procures prescription medicines"],
      exclusions: ["Veterinary-only providers"],
      recommendedDecisionMakerRoles: ["Chief pharmacist"],
      summary: "Hospitals procuring prescription medicines in Lithuania.",
    },
    targetSegments: [
      {
        id: "hospital-procurement",
        name: "Hospital procurement teams",
        summary: "Hospitals procuring prescription medicines.",
        relationshipType: "customer",
        organizationTypes: ["Hospital"],
        industries: ["Healthcare"],
        geographies: ["LT"],
        characteristics: ["Institutional procurement"],
        buyingSignals: ["Publishes medicine tenders"],
        likelyBuyerRoles: ["Chief pharmacist"],
        exclusions: ["Veterinary-only providers"],
        rationale: "Hospitals buy medicines for clinical use.",
        supportingEvidence: [],
        discoverability: "high",
        source: "saved_template",
        confidence: "high",
        status: "confirmed",
      },
    ],
    desiredQualifiedCompanies: 25,
  };
}
