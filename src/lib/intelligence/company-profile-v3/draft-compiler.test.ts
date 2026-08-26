import assert from "node:assert/strict";
import test from "node:test";
import { compileProfileV3Draft } from "./draft-compiler.ts";
import {
  profileBuyerLogicOutputSchema,
  profileClarificationOutputSchema,
  profileCommercialSynthesisOutputSchema,
  profileConsistencyOutputSchema,
  profileOfferingDecompositionOutputSchema,
} from "./task-contracts.ts";

test("V3 compilation preserves explicit offering-to-archetype relationships", () => {
  const compiled = compileProfileV3Draft({
    workspaceId: "00000000-0000-4000-8000-000000000001",
    profileDraftId: "00000000-0000-4000-8000-000000000002",
    companyProfileId: "00000000-0000-4000-8000-000000000003",
    baseSnapshot: { identity: { publicName: "Example" } },
    commercial: profileCommercialSynthesisOutputSchema.parse({
      primaryRoles: [
        {
          role: "manufacturer",
          importance: "primary",
          confidence: 0.8,
          evidenceIds: [],
        },
      ],
      valueChainPosition: ["producer"],
      revenueMechanics: [],
      transactionModels: ["wholesale_order"],
      deliveryModels: ["physical"],
      customerConsumptionModes: ["resell"],
      channelModels: ["direct"],
      commercialConstraints: [],
      unresolvedCommercialQuestions: [],
      conciseCommercialSummary: "Produces goods for resale.",
    }),
    offerings: profileOfferingDecompositionOutputSchema.parse({
      offerings: [
        {
          offeringKey: "core-products",
          name: "Core products",
          offeringType: "product",
          shortDescription: "Products sold through distributors.",
          includedItemKeys: [],
          excludedItemKeys: [],
          valueProposition: "Reliable supply.",
          customerProblems: ["Supply continuity"],
          expectedOutcomes: ["Available stock"],
          customerConsumptionMode: "resell",
          buyingMotion: "wholesale_order",
          dependencies: [],
          commercialConstraints: [],
          evidenceIds: [],
          confidence: 0.8,
        },
      ],
      ungroupedItems: [],
      groupingWarnings: [],
    }),
    buyerLogic: profileBuyerLogicOutputSchema.parse({
      offeringBuyerLogic: [buyerLogic("core-products", ["Reliable supply"])],
      archetypes: [
        {
          archetypeKey: "distributor",
          offeringKey: "core-products",
          name: "Distributor",
          relationshipType: "distributor",
          priority: "priority",
          description: "Resells the products.",
          whyCompatible: ["Has a resale channel"],
          requiredEvidence: [],
          positiveSignals: [],
          negativeSignals: [],
          likelyDecisionRoles: [],
          evidenceIds: [],
          epistemicStatus: "hypothesis",
          confidence: 0.7,
        },
      ],
      proposedOfferingRules: [],
      unresolvedQuestions: [],
    }),
    clarification: profileClarificationOutputSchema.parse({
      questions: [],
      omittedQuestions: [],
    }),
    consistency: profileConsistencyOutputSchema.parse({
      findings: [],
      publishRecommendation: "ready_with_warnings",
      conciseSummary: "Review before publishing.",
    }),
  });

  assert.equal(compiled.offerings[0]?.archetypes[0]?.archetypeKey, "distributor");
  assert.equal(
    compiled.offerings[0]?.relationshipOptions[0]?.relationshipType,
    "distributor",
  );
  assert.equal(compiled.businessModel.primaryRole, "manufacturer");
  assert.match(compiled.compiledSnapshotHash, /^[a-f0-9]{64}$/);
});

test("V3 compilation rejects archetypes assigned to unknown offerings", () => {
  const buyer = profileBuyerLogicOutputSchema.parse({
    offeringBuyerLogic: [buyerLogic("known", ["A defined commercial need"])],
    archetypes: [
      {
        archetypeKey: "bad",
        offeringKey: "missing",
        name: "Bad",
        relationshipType: "buyer",
        priority: "conditional",
        description: "Invalid reference.",
        whyCompatible: [],
        requiredEvidence: [],
        positiveSignals: [],
        negativeSignals: [],
        likelyDecisionRoles: [],
        evidenceIds: [],
        epistemicStatus: "hypothesis",
        confidence: 0.2,
      },
    ],
    proposedOfferingRules: [],
    unresolvedQuestions: [],
  });
  assert.throws(
    () =>
      compileProfileV3Draft({
        workspaceId: "w",
        profileDraftId: "d",
        companyProfileId: "p",
        baseSnapshot: {},
        commercial: profileCommercialSynthesisOutputSchema.parse({
          primaryRoles: [],
          valueChainPosition: [],
          revenueMechanics: [],
          transactionModels: [],
          deliveryModels: [],
          customerConsumptionModes: [],
          channelModels: [],
          commercialConstraints: [],
          unresolvedCommercialQuestions: [],
          conciseCommercialSummary: "",
        }),
        offerings: profileOfferingDecompositionOutputSchema.parse({
          offerings: [
            {
              offeringKey: "known",
              name: "Known",
              offeringType: "service",
              shortDescription: "Known offering",
              includedItemKeys: [],
              excludedItemKeys: [],
              valueProposition: "",
              customerProblems: [],
              expectedOutcomes: [],
              customerConsumptionMode: "use",
              buyingMotion: "project",
              dependencies: [],
              commercialConstraints: [],
              evidenceIds: [],
              confidence: 0.5,
            },
          ],
          ungroupedItems: [],
          groupingWarnings: [],
        }),
        buyerLogic: buyer,
        clarification: profileClarificationOutputSchema.parse({
          questions: [],
          omittedQuestions: [],
        }),
        consistency: profileConsistencyOutputSchema.parse({
          findings: [],
          publishRecommendation: "needs_input",
          conciseSummary: "",
        }),
      }),
    /unknown offering/,
  );
});

test("multi-offering compilation keeps product and consulting buyer logic distinct", () => {
  const input = compilationFixture();
  input.offerings = profileOfferingDecompositionOutputSchema.parse({
    offerings: [
      offering("product", "Core product", "resell", "wholesale_order"),
      offering("consulting", "Consulting service", "use", "project"),
    ],
    ungroupedItems: [],
    groupingWarnings: [],
  });
  input.buyerLogic = profileBuyerLogicOutputSchema.parse({
    offeringBuyerLogic: [
      buyerLogic("product", ["Stock a profitable product"], ["Distribution network"]),
      buyerLogic("consulting", ["Solve an operational problem"], ["Executive sponsor"]),
    ],
    archetypes: [
      archetype("product-distributor", "product", "distributor"),
      archetype("consulting-buyer", "consulting", "direct_buyer"),
    ],
    proposedOfferingRules: [],
    unresolvedQuestions: [],
  });
  const compiled = compileProfileV3Draft(input);
  assert.deepEqual(compiled.offerings[0]?.buyerLogic.whyBuy, [
    "Stock a profitable product",
  ]);
  assert.deepEqual(compiled.offerings[1]?.buyerLogic.whyBuy, [
    "Solve an operational problem",
  ]);
  assert.deepEqual(compiled.offerings[1]?.buyerLogic.requiredConditions, [
    "Executive sponsor",
  ]);
  assert.equal(
    compiled.offerings[1]?.relationshipOptions[0]?.relationshipType,
    "direct_buyer",
  );
});

test("compilation scopes duplicate archetype keys emitted for different offerings", () => {
  const input = compilationFixture();
  input.offerings = profileOfferingDecompositionOutputSchema.parse({
    offerings: [
      offering("product", "Core product", "resell", "wholesale_order"),
      offering("consulting", "Consulting service", "use", "project"),
    ],
    ungroupedItems: [],
    groupingWarnings: [],
  });
  input.buyerLogic = profileBuyerLogicOutputSchema.parse({
    offeringBuyerLogic: [
      buyerLogic("product", ["Stock the product"]),
      buyerLogic("consulting", ["Improve operations"]),
    ],
    archetypes: [
      archetype("horeca-operator", "product", "distributor"),
      archetype("horeca-operator", "consulting", "direct_buyer"),
    ],
    proposedOfferingRules: [],
    unresolvedQuestions: [],
  });

  const compiled = compileProfileV3Draft(input);

  assert.equal(compiled.offerings[0]?.archetypes[0]?.archetypeKey, "horeca-operator");
  assert.equal(
    compiled.offerings[1]?.archetypes[0]?.archetypeKey,
    "horeca-operator--consulting",
  );
  assert.equal(
    compiled.compiledSnapshot.buyerLogic.archetypes[1]?.archetypeKey,
    "horeca-operator--consulting",
  );
});

test("compilation rejects missing, unknown, and duplicate offering buyer logic", () => {
  const input = compilationFixture();
  assert.throws(
    () =>
      compileProfileV3Draft({
        ...input,
        buyerLogic: profileBuyerLogicOutputSchema.parse({
          offeringBuyerLogic: [buyerLogic("unknown", ["Unknown reason"])],
          archetypes: [],
          proposedOfferingRules: [],
          unresolvedQuestions: [],
        }),
      }),
    /unknown offering/,
  );
  assert.throws(
    () =>
      profileBuyerLogicOutputSchema.parse({
        offeringBuyerLogic: [
          buyerLogic("known", ["Reason one"]),
          buyerLogic("known", ["Reason two"]),
        ],
        archetypes: [],
        proposedOfferingRules: [],
        unresolvedQuestions: [],
      }),
    /duplicate offering keys/,
  );
});

function buyerLogic(
  offeringKey: string,
  whyBuy: string[],
  requiredConditions: string[] = [],
) {
  return {
    offeringKey,
    whyBuy,
    requiredConditions,
    preferredConditions: [],
    likelyTriggers: [],
    incompatibleConditions: [],
    likelyDecisionRoles: [],
    positiveEvidenceSignals: [],
    negativeEvidenceSignals: [],
    evidenceIds: [],
    confidence: 0.75,
  };
}

function offering(
  offeringKey: string,
  name: string,
  customerConsumptionMode: "use" | "resell",
  buyingMotion: "project" | "wholesale_order",
) {
  return {
    offeringKey,
    name,
    offeringType: buyingMotion === "project" ? "service" : "product",
    shortDescription: `${name} description`,
    includedItemKeys: [],
    excludedItemKeys: [],
    valueProposition: `${name} value`,
    customerProblems: ["Commercial problem"],
    expectedOutcomes: ["Commercial outcome"],
    customerConsumptionMode,
    buyingMotion,
    dependencies: [],
    commercialConstraints: [],
    evidenceIds: [],
    confidence: 0.8,
  };
}

function archetype(archetypeKey: string, offeringKey: string, relationshipType: string) {
  return {
    archetypeKey,
    offeringKey,
    name: archetypeKey,
    relationshipType,
    priority: "priority" as const,
    description: "Offering-specific buyer archetype.",
    whyCompatible: ["Commercially compatible"],
    requiredEvidence: [],
    positiveSignals: [],
    negativeSignals: [],
    likelyDecisionRoles: [],
    evidenceIds: [],
    epistemicStatus: "hypothesis" as const,
    confidence: 0.7,
  };
}

function compilationFixture(): Parameters<typeof compileProfileV3Draft>[0] {
  return {
    workspaceId: "w",
    profileDraftId: "d",
    companyProfileId: "p",
    baseSnapshot: {},
    commercial: profileCommercialSynthesisOutputSchema.parse({
      primaryRoles: [],
      valueChainPosition: [],
      revenueMechanics: [],
      transactionModels: [],
      deliveryModels: [],
      customerConsumptionModes: [],
      channelModels: [],
      commercialConstraints: [],
      unresolvedCommercialQuestions: [],
      conciseCommercialSummary: "Summary",
    }),
    offerings: profileOfferingDecompositionOutputSchema.parse({
      offerings: [offering("known", "Known", "use", "project")],
      ungroupedItems: [],
      groupingWarnings: [],
    }),
    buyerLogic: profileBuyerLogicOutputSchema.parse({
      offeringBuyerLogic: [buyerLogic("known", ["Reason"])],
      archetypes: [],
      proposedOfferingRules: [],
      unresolvedQuestions: [],
    }),
    clarification: profileClarificationOutputSchema.parse({
      questions: [],
      omittedQuestions: [],
    }),
    consistency: profileConsistencyOutputSchema.parse({
      findings: [],
      publishRecommendation: "ready_with_warnings",
      conciseSummary: "Review",
    }),
  };
}
