import type { ConfirmedCampaignBrief } from "@/lib/campaign-workflow/contracts";
import type { CampaignPlanningOffering } from "./planning-profile.ts";
import { buildNativeCampaignStrategyV2 } from "./native-strategy.ts";

export function createNativeCampaignStrategyFixture() {
  return buildNativeCampaignStrategyV2({
    campaignId: "campaign-1",
    strategyDraftId: "strategy-1",
    profileVersionId: "profile-1",
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
      localLanguages: ["Lithuanian"],
      workingLanguages: ["English"],
      userConfirmed: true,
    },
    applicableProfileRules: [],
  });
}

function offering(): CampaignPlanningOffering {
  return {
    stableKey: "operations-platform",
    offeringId: "offering-1",
    offeringVersionId: "offering-version-1",
    slug: "operations-platform",
    name: "Operations platform",
    offeringType: "software",
    shortDescription: "Operational software for industrial organizations.",
    confidence: 0.85,
    commercialMechanics: {
      buyingMotion: "sales_assisted",
      customerConsumptionMode: "own_use",
      dependencies: [],
      valueProposition: ["Simpler operations"],
      customerProblems: ["Operational complexity"],
      expectedOutcomes: ["Lower operating cost"],
      transactionModels: ["subscription"],
    },
    buyerLogic: {
      offeringKey: "operations-platform",
      whyBuy: ["Improve industrial operations"],
      requiredConditions: ["Operates production facilities"],
      preferredConditions: ["Multiple production sites"],
      likelyTriggers: ["Operational modernization"],
      incompatibleConditions: ["Software vendor"],
      likelyDecisionRoles: ["Operations director"],
      positiveEvidenceSignals: ["Operates production facilities"],
      negativeEvidenceSignals: ["Sells competing software"],
      evidenceIds: [],
      confidence: 0.85,
    },
    relationshipOptions: [
      {
        relationshipType: "direct_buyer",
        relevance: "primary",
        rationale: "Industrial operators buy the software for their own use.",
        confidence: 0.85,
      },
    ],
    archetypes: [
      {
        key: "industrial-operator",
        name: "Industrial operators",
        relationshipType: "direct_buyer",
        priority: "priority",
        status: "user_confirmed",
        description: "Manufacturers operating production facilities.",
        whyCompatible: ["They manage industrial operations."],
        requiredEvidence: ["Evidence of production operations"],
        positiveSignals: ["Multiple production sites"],
        negativeSignals: ["Software vendor"],
        likelyDecisionRoles: ["Operations director"],
        confidence: 0.85,
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
      profileOfferingIds: ["operations-platform"],
      title: "Operations platform",
      summary: "Operational software for industrial organizations.",
      valueProposition: "Simpler operations.",
      rationale: "Selected from the published Company Profile.",
    },
    targetClient: {
      companyTypes: ["Manufacturer"],
      industries: ["Industrial equipment"],
      characteristics: ["Operates production facilities"],
      positiveSignals: ["Multiple production sites"],
      requiredCriteria: ["Has an operations team"],
      exclusions: ["Software vendors"],
      recommendedDecisionMakerRoles: ["Operations director"],
      summary: "Industrial operators in Lithuania.",
    },
    targetSegments: [
      {
        id: "industrial-operator",
        name: "Industrial operators",
        summary: "Manufacturers operating production facilities.",
        relationshipType: "customer",
        organizationTypes: ["Manufacturer"],
        industries: ["Industrial equipment"],
        geographies: ["LT"],
        characteristics: ["Operates production facilities"],
        buyingSignals: ["Multiple production sites"],
        likelyBuyerRoles: ["Operations director"],
        exclusions: ["Software vendors"],
        rationale: "They may buy operational software for their own use.",
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
