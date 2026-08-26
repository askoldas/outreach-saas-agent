import assert from "node:assert/strict";
import test from "node:test";
import { companyIntelligenceV3Schema } from "../company-profile-v3/schemas.ts";
import { compileCommercialIntelligence } from "./commercial-intelligence-compiler.ts";

test("Company Profile offerings compile into distinct commercial hypotheses", () => {
  const result = compileCommercialIntelligence({
    artifactId: "artifact-1",
    workspaceId: "workspace-1",
    profile: profileFixture(),
    createdAt: "2026-08-24T00:00:00.000Z",
  });
  assert.equal(result.offerings.length, 2);
  assert.deepEqual(result.offerings[0]?.customerProblems, ["Packaging waste"]);
  assert.deepEqual(result.offerings[1]?.customerProblems, ["Manual reporting"]);
  assert.notDeepEqual(
    result.offerings[0]?.possibleCustomerArchetypes,
    result.offerings[1]?.possibleCustomerArchetypes,
  );
});

test("commercial relationships remain non-exclusive and direct buyer normalizes to buyer", () => {
  const result = compileCommercialIntelligence({
    artifactId: "artifact-1",
    workspaceId: "workspace-1",
    profile: profileFixture(),
    createdAt: "2026-08-24T00:00:00.000Z",
  });
  assert.deepEqual(result.offerings[0]?.possibleRelationships, ["buyer", "distributor"]);
  assert.deepEqual(
    result.offerings[0]?.possibleCustomerArchetypes[0]?.possibleRelationships,
    ["buyer", "distributor", "manufacturer"],
  );
});

test("compiler preserves evidence and scoped exclusions without inventing claims", () => {
  const result = compileCommercialIntelligence({
    artifactId: "artifact-1",
    workspaceId: "workspace-1",
    profile: profileFixture(),
    createdAt: "2026-08-24T00:00:00.000Z",
  });
  assert.deepEqual(result.claims, []);
  assert.ok(result.evidenceIds.includes("evidence-packaging"));
  assert.deepEqual(result.offerings[0]?.ruleKeys, ["exclude.closed"]);
  assert.deepEqual(result.offerings[1]?.ruleKeys, []);
  assert.equal(result.rules[0]?.ruleType, "hard_exclusion");
});

test("compiler is content-deterministic and rejects unpublished profiles", () => {
  const profile = profileFixture();
  const first = compileCommercialIntelligence({
    artifactId: "artifact-1",
    workspaceId: "workspace-1",
    profile,
    createdAt: "2026-08-24T00:00:00.000Z",
  });
  const second = compileCommercialIntelligence({
    artifactId: "artifact-2",
    workspaceId: "workspace-1",
    profile,
    createdAt: "2026-08-25T00:00:00.000Z",
  });
  assert.equal(first.version.inputHash, second.version.inputHash);
  assert.equal(first.version.contentHash, second.version.contentHash);
  assert.throws(
    () =>
      compileCommercialIntelligence({
        artifactId: "artifact-3",
        workspaceId: "workspace-1",
        profile: { ...profile, status: "draft" },
        createdAt: "2026-08-24T00:00:00.000Z",
      }),
    /published Company Profile V3/,
  );
});

function profileFixture() {
  const offerings = [
    offering({
      id: "offering-packaging",
      name: "Reusable packaging",
      problem: "Packaging waste",
      useCase: "Move goods in reusable containers",
      evidenceId: "evidence-packaging",
      relationships: ["direct_buyer", "distributor"],
    }),
    offering({
      id: "offering-software",
      name: "Reporting software",
      problem: "Manual reporting",
      useCase: "Automate operational reporting",
      evidenceId: "evidence-software",
      relationships: ["direct_buyer"],
    }),
  ];
  return companyIntelligenceV3Schema.parse({
    schemaVersion: 3,
    profileVersionId: "profile-version-1",
    status: "published",
    identity: {
      id: "company-1",
      workspaceId: "workspace-1",
      publicName: "Example Seller",
      tradingNames: [],
      brands: [],
      canonicalDomain: "seller.example",
      additionalDomains: [],
      operatingLocations: [],
      marketsServed: [],
      supportedLanguages: ["English"],
    },
    businessModel: {
      summary: "Provides reusable packaging and reporting software.",
      roles: [
        {
          role: "manufacturer",
          importance: "primary",
          confidence: 0.9,
          evidenceIds: ["evidence-seller"],
          explanation: "Manufactures reusable packaging.",
        },
        {
          role: "software_provider",
          importance: "secondary",
          confidence: 0.8,
          evidenceIds: ["evidence-seller"],
          explanation: "Provides supporting software.",
        },
      ],
      valueCreation: ["Design reusable packaging"],
      valueDelivery: ["Supply operational systems"],
      valueCapture: [],
      customerRelationshipModels: [],
      salesMotions: [],
      revenuePatterns: [],
      sellsForOwnUse: false,
      sellsForResale: true,
      sellsThroughPartners: true,
      constraints: [],
      confidence: 0.85,
      evidenceIds: ["evidence-seller"],
    },
    offerings,
    buyerArchetypes: [
      archetype({
        id: "archetype-manufacturer",
        offeringId: "offering-packaging",
        name: "Regional manufacturer",
        relationshipType: "manufacturer",
        need: "Repeated material movement",
        evidenceId: "evidence-packaging",
      }),
      archetype({
        id: "archetype-operator",
        offeringId: "offering-software",
        name: "Multi-site operator",
        relationshipType: "direct_buyer",
        need: "Cross-location reporting",
        evidenceId: "evidence-software",
      }),
    ],
    rules: [
      {
        ruleKey: "exclude.closed",
        label: "Closed organizations",
        description: "Exclude confirmed closed organizations.",
        ruleType: "hard_exclusion",
        scope: "offering",
        strength: "hard",
        applicability: {
          objectives: [],
          offeringIds: ["offering-packaging"],
          geographies: [],
          relationshipTypes: [],
          archetypeIds: [],
        },
        status: "confirmed",
        source: "user",
        evidenceIds: [],
        confidence: 1,
      },
    ],
    unresolvedCriticalConflictIds: [],
  });
}

function offering(input: {
  id: string;
  name: string;
  problem: string;
  useCase: string;
  evidenceId: string;
  relationships: string[];
}) {
  return {
    id: input.id,
    profileVersionId: "profile-version-1",
    name: input.name,
    slug: input.id,
    shortDescription: input.name,
    offeringType: "physical_product",
    variants: [],
    customerProblem: [input.problem],
    promisedOutcomes: [input.useCase],
    useCases: [input.useCase],
    commercialMechanics: {
      transactionModels: ["one_time_purchase"],
      purchaseMotion: "procurement_led",
      customerUseMode: "mixed",
      typicalRelationship: "recurring",
      confidence: 0.8,
      evidenceIds: [input.evidenceId],
    },
    buyerLogic: {
      whyBuy: [input.problem],
      buyingTriggers: [],
      requiredCapabilities: [],
      preferredCharacteristics: [],
      incompatibleCharacteristics: [],
      buyerRoles: [],
      procurementModel: {
        motion: "unknown",
        participants: [],
        confidence: 0,
        evidenceIds: [],
      },
      likelyAlternatives: [],
      likelyObjections: [],
      positiveEvidenceSignals: [
        { key: `${input.id}.positive`, description: input.useCase, observableIn: [] },
      ],
      negativeEvidenceSignals: [],
      confidence: 0.8,
      evidenceIds: [input.evidenceId],
    },
    relationshipOptions: input.relationships.map((relationshipType) => ({
      relationshipType,
      relevance: "primary",
      rationale: "Supported by the offering buyer logic.",
      requiredConditions: [],
      incompatibleConditions: [],
      confidence: 0.8,
      evidenceIds: [input.evidenceId],
    })),
    availability: { geographies: [], excludedGeographies: [], notes: [] },
    constraints: [],
    status: "active",
    confidence: 0.8,
    claimIds: [],
    evidenceIds: [input.evidenceId],
  };
}

function archetype(input: {
  id: string;
  offeringId: string;
  name: string;
  relationshipType: string;
  need: string;
  evidenceId: string;
}) {
  return {
    id: input.id,
    offeringId: input.offeringId,
    name: input.name,
    description: input.name,
    relationshipType: input.relationshipType,
    priority: "priority",
    businessRoles: [],
    businessModels: [],
    industries: [],
    commercialNeed: [input.need],
    whyCompatible: [input.need],
    requiredConditions: [],
    preferredConditions: [],
    incompatibleConditions: [],
    positiveEvidenceSignals: [],
    negativeEvidenceSignals: [],
    likelyBuyerRoles: [],
    status: "user_confirmed",
    confidence: 0.8,
    claimIds: [],
    evidenceIds: [input.evidenceId],
  };
}
