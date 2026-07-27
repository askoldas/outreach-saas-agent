import assert from "node:assert/strict";
import test from "node:test";
import {
  createEmptyStructuredProfile,
  type Offering,
} from "../../company-profile/structured-profile.ts";
import { evaluateProfileV3Readiness } from "./readiness.ts";
import { companyIntelligenceV3Schema, offeringIntelligenceV3Schema } from "./schemas.ts";
import { adaptV2ProfileToV3Draft } from "./v2-adapter.ts";

test("V3 rejects active offerings without relationship hypotheses", () => {
  const offering = v3Offering();
  assert.throws(() =>
    offeringIntelligenceV3Schema.parse({ ...offering, relationshipOptions: [] }),
  );
});

test("V3 rejects wholesale-only mechanics represented as own use", () => {
  const offering = v3Offering();
  assert.throws(() =>
    offeringIntelligenceV3Schema.parse({
      ...offering,
      commercialMechanics: {
        ...offering.commercialMechanics,
        customerUseMode: "own_use",
        transactionModels: ["wholesale_order"],
      },
    }),
  );
});

test("V3 rejects priority archetypes without compatibility rationale", () => {
  const profile = publishableProfile();
  assert.throws(() =>
    companyIntelligenceV3Schema.parse({
      ...profile,
      buyerArchetypes: [
        {
          id: "archetype-1",
          offeringId: "offering-1",
          name: "Operators",
          description: "Operators with a recurring need.",
          relationshipType: "direct_buyer",
          priority: "priority",
          businessRoles: [],
          businessModels: [],
          industries: [],
          commercialNeed: [],
          whyCompatible: [],
          requiredConditions: [],
          preferredConditions: [],
          incompatibleConditions: [],
          positiveEvidenceSignals: [],
          negativeEvidenceSignals: [],
          likelyBuyerRoles: [],
          status: "proposed",
          confidence: 0.5,
          claimIds: [],
          evidenceIds: [],
        },
      ],
    }),
  );
});

test("V3 keeps profile rules and offerings inside the frozen profile boundary", () => {
  const profile = publishableProfile();
  assert.throws(() =>
    companyIntelligenceV3Schema.parse({
      ...profile,
      offerings: [{ ...v3Offering(), profileVersionId: "another-version" }],
    }),
  );
  assert.throws(() =>
    companyIntelligenceV3Schema.parse({
      ...profile,
      rules: [
        {
          ruleKey: "campaign-only",
          label: "Campaign rule",
          description: "Must not enter global profile scope.",
          ruleType: "preference",
          scope: "campaign",
          strength: "soft",
          applicability: {},
          status: "proposed",
          source: "user",
          evidenceIds: [],
          confidence: 1,
        },
      ],
    }),
  );
});

test("readiness follows the publish gate rather than optional-field completeness", () => {
  const profile = companyIntelligenceV3Schema.parse(publishableProfile());
  assert.deepEqual(evaluateProfileV3Readiness(profile), {
    publishable: true,
    score: 97,
    blockers: [],
    warnings: ["Primary service has an unknown purchase motion."],
  });

  const blocked = companyIntelligenceV3Schema.parse({
    ...profile,
    unresolvedCriticalConflictIds: ["conflict-1"],
  });
  assert.equal(evaluateProfileV3Readiness(blocked).publishable, false);
  assert.match(
    evaluateProfileV3Readiness(blocked).blockers.join(" "),
    /Critical claim conflicts/,
  );
});

test("V2 adapter creates a provisional V3 draft without upgrading legacy facts", () => {
  const legacy = createEmptyStructuredProfile({
    name: "Example Software",
    websiteUrl: "https://www.example.test",
    language: "English",
  });
  legacy.shortOverview = "Example Software provides an operations platform.";
  legacy.businessModels = ["saas_software"];
  legacy.offerings = [legacyOffering()];

  const draft = adaptV2ProfileToV3Draft({
    workspaceId: "workspace-1",
    profileVersionId: "profile-v2-1",
    profile: legacy,
  });

  assert.equal(draft.schemaVersion, 3);
  assert.equal(draft.status, "draft");
  assert.equal(draft.identity.canonicalDomain, "example.test");
  assert.equal(draft.offerings[0]?.status, "uncertain");
  assert.equal(draft.offerings[0]?.confidence, 0.25);
  assert.equal(draft.legacyImport?.requiresUserReview, true);
  assert.equal(evaluateProfileV3Readiness(draft).publishable, false);
  assert.ok(draft.rules.every((rule) => rule.status === "proposed"));
  assert.ok(draft.offerings.every((offering) => offering.evidenceIds.length === 0));
});

test("V2 distributor semantics remain resale-oriented and provisional", () => {
  const legacy = createEmptyStructuredProfile({
    name: "Example Distributor",
    websiteUrl: "https://distribution.example",
  });
  legacy.shortOverview = "Example Distributor supplies equipment.";
  legacy.businessModels = ["distributor_wholesaler"];
  legacy.offerings = [
    legacyOffering({
      id: "equipment-supply",
      name: "Equipment supply",
      businessModel: "distributor_wholesaler",
      offeringType: "wholesale supply",
    }),
  ];
  const draft = adaptV2ProfileToV3Draft({
    workspaceId: "workspace-2",
    profileVersionId: "profile-v2-2",
    profile: legacy,
  });
  assert.equal(draft.offerings[0]?.commercialMechanics.customerUseMode, "resale");
  assert.equal(draft.offerings[0]?.relationshipOptions[0]?.relationshipType, "reseller");
  assert.equal(draft.offerings[0]?.relationshipOptions[0]?.relevance, "possible");
});

function publishableProfile() {
  return {
    schemaVersion: 3 as const,
    profileVersionId: "profile-v3-1",
    status: "draft" as const,
    identity: {
      id: "identity-1",
      workspaceId: "workspace-1",
      publicName: "Example",
      canonicalDomain: "example.test",
      tradingNames: [],
      brands: [],
      additionalDomains: [],
      operatingLocations: [],
      marketsServed: [],
      supportedLanguages: [],
    },
    businessModel: {
      summary: "Example sells a recurring operational service.",
      roles: [],
      valueCreation: [],
      valueDelivery: [],
      valueCapture: [],
      customerRelationshipModels: [],
      salesMotions: [],
      revenuePatterns: [],
      sellsForOwnUse: null,
      sellsForResale: null,
      sellsThroughPartners: null,
      constraints: [],
      confidence: 0.7,
      evidenceIds: [],
    },
    offerings: [v3Offering()],
    buyerArchetypes: [],
    rules: [],
    unresolvedCriticalConflictIds: [],
  };
}

function v3Offering() {
  return {
    id: "offering-1",
    profileVersionId: "profile-v3-1",
    name: "Primary service",
    slug: "primary-service",
    shortDescription: "A recurring operational service.",
    offeringType: "service" as const,
    variants: [],
    customerProblem: ["Operational complexity"],
    promisedOutcomes: ["Simpler operations"],
    useCases: [],
    commercialMechanics: {
      transactionModels: ["subscription" as const],
      purchaseMotion: "unknown" as const,
      customerUseMode: "own_use" as const,
      typicalRelationship: "recurring" as const,
      confidence: 0.7,
      evidenceIds: [],
    },
    buyerLogic: {
      whyBuy: ["Simpler operations"],
      buyingTriggers: [],
      requiredCapabilities: [],
      preferredCharacteristics: [],
      incompatibleCharacteristics: [],
      buyerRoles: [],
      procurementModel: {
        motion: "unknown" as const,
        participants: [],
        confidence: 0,
        evidenceIds: [],
      },
      likelyAlternatives: [],
      likelyObjections: [],
      positiveEvidenceSignals: [],
      negativeEvidenceSignals: [],
      confidence: 0.5,
      evidenceIds: [],
    },
    relationshipOptions: [
      {
        relationshipType: "direct_buyer" as const,
        relevance: "primary" as const,
        rationale: "The organization buys the service for its own operations.",
        requiredConditions: [],
        incompatibleConditions: [],
        confidence: 0.7,
        evidenceIds: [],
      },
    ],
    availability: { geographies: [], excludedGeographies: [], notes: [] },
    constraints: [],
    status: "active" as const,
    confidence: 0.7,
    claimIds: [],
    evidenceIds: [],
  };
}

function legacyOffering(overrides: Partial<Offering> = {}): Offering {
  return {
    id: "operations-platform",
    name: "Operations platform",
    offeringType: "software",
    businessModel: "saas_software",
    shortDescription: "Operations software.",
    valueProposition: "Simpler operations.",
    customerProblems: ["Operational complexity"],
    expectedOutcomes: ["Simpler operations"],
    useCases: ["Operations management"],
    targetCustomerTypes: ["Businesses"],
    targetIndustries: [],
    targetCompanySizes: [],
    buyerPersonas: [],
    currentMarkets: [],
    prospectingMarkets: [],
    qualificationRequirements: [],
    disqualifyingConditions: [],
    commercialConstraints: [],
    supportingCapabilityIds: [],
    productCategories: [],
    supportingProofIds: [],
    adaptiveFields: {},
    priority: "primary",
    status: "confirmed",
    sourceReferences: [],
    ...overrides,
  };
}
