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
      purchaseLogic: {
        whyBuy: ["Reliable supply"],
        requiredConditions: [],
        preferredConditions: [],
        likelyTriggers: [],
        incompatibleConditions: [],
      },
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
    purchaseLogic: {
      whyBuy: [],
      requiredConditions: [],
      preferredConditions: [],
      likelyTriggers: [],
      incompatibleConditions: [],
    },
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
