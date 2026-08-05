import {
  parseConfirmedCampaignBrief,
  type ConfirmedCampaignBrief,
} from "@/lib/campaign-workflow/contracts";
import {
  buildNativeCampaignStrategyV2,
  campaignGeographyV2Schema,
  campaignObjectiveV2Schema,
  compileCampaignCommercialContext,
  compileCampaignStrategyV2,
  hashCanonical,
  generateMarketSpecificStrategy,
  nativeCampaignStrategyEntryContract,
  resolveCampaignObjective,
} from "@/lib/intelligence/campaign-strategy-v2";
import { intelligenceRuleSchema } from "@/lib/intelligence/contracts/rules";
import type { Campaign } from "@/types/domain";
import type { Json } from "@/types/database.types";
import { deriveCampaignDiscoveryLanguagePolicy } from "@/lib/discovery/languages";
import {
  createCampaignStrategyV2Draft,
  getCampaignStrategyV2RecoveryData,
  getPublishedCampaignPlanningProfile,
  getPublishedCampaignProfileContext,
  persistCampaignStrategyV2Compilation,
  recordCampaignStrategyModelCalls,
} from "./repository";
import { campaignV2TaskContracts } from "@/lib/intelligence/campaign-strategy-v2/task-contracts";
import { intelligenceResultCacheKey } from "@/lib/intelligence/runtime/cache-key";
import {
  claimCampaignStrategyStage,
  completeCampaignStrategyStage,
  failCampaignStrategyStage,
} from "./stage-repository";
import {
  campaignStrategyBaselineContract,
  campaignStrategyModelRouteVersion,
} from "./stage-contracts";

export async function createInitialCampaignStrategyV2(input: {
  workspaceId: string;
  campaign: Campaign;
  confirmedBrief: ConfirmedCampaignBrief;
  objectiveCode: string;
}) {
  const stableKey = input.confirmedBrief.offering.profileOfferingIds[0];
  if (!stableKey) throw new Error("A published offering must be selected.");
  const profile = await getPublishedCampaignProfileContext(input.workspaceId, stableKey);
  const discoveryLanguagePolicy = deriveCampaignDiscoveryLanguagePolicy({
    countryCodes: input.confirmedBrief.geography.countryCodes,
    primaryLanguage: input.confirmedBrief.geography.primaryLanguage,
  });
  const geography = {
    mode: input.confirmedBrief.geography.countryCodes.includes("WORLDWIDE")
      ? ("region" as const)
      : input.confirmedBrief.geography.countryCodes.length === 1
        ? ("country" as const)
        : ("multi_country" as const),
    displayName:
      input.confirmedBrief.geography.regionLabel ||
      input.confirmedBrief.geography.countryCodes.join(", "),
    countryCodes: input.confirmedBrief.geography.countryCodes,
    includedRegions: [],
    includedCities: [],
    excludedRegions: [],
    excludedCities: [],
    localLanguages: discoveryLanguagePolicy.localLanguages,
    workingLanguages: discoveryLanguagePolicy.workingLanguages,
    userConfirmed: true,
  };
  const objectiveCode = resolveCampaignObjective(input.objectiveCode);
  const objective = {
    code: objectiveCode,
    label: `Find ${objectiveCode.replaceAll("_", " ")}`,
    description: input.confirmedBrief.targetClient.summary,
    targetRelationshipTypes: [objectiveCode],
    normallyExcludedRelationshipTypes: (["competitor", "supplier"] as const).filter(
      (relationship) => relationship !== objectiveCode,
    ),
    userConfirmed: true,
  };
  const offering = profile.offering;
  const context = compileCampaignCommercialContext({
    workspaceId: input.workspaceId,
    profileVersionId: profile.profileVersionId,
    offeringReferences: [
      {
        companyProfileVersionId: profile.profileVersionId,
        offeringId: profile.offeringId,
        offeringVersionId: offering.offeringVersionId,
      },
    ],
    objective,
    geography,
    companyRoles: profile.companyRoles,
    offerings: [
      {
        offeringVersionId: offering.offeringVersionId,
        summary: offering.shortDescription,
        valueDelivered: [
          ...offering.commercialMechanics.valueProposition,
          ...offering.commercialMechanics.expectedOutcomes,
        ],
        transactionModels: offering.commercialMechanics.transactionModels.length
          ? offering.commercialMechanics.transactionModels
          : [offering.commercialMechanics.buyingMotion],
        buyerUseModes: [offering.commercialMechanics.customerConsumptionMode],
      },
    ],
    buyerHypotheses: offering.archetypes
      .filter(
        (archetype) =>
          archetype.status !== "user_rejected" &&
          archetype.status !== "superseded" &&
          archetype.priority !== "avoid",
      )
      .map((archetype) => ({
        offeringVersionId: offering.offeringVersionId,
        relationshipType: objectiveCode,
        summary: `${archetype.name}: ${archetype.description}`,
      })),
    rules: profile.rules,
    claims: [],
  });
  const campaignInput = {
    entryContract: nativeCampaignStrategyEntryContract,
    geography,
    objective,
    offeringReferences: [
      {
        companyProfileVersionId: profile.profileVersionId,
        offeringId: profile.offeringId,
        offeringVersionId: offering.offeringVersionId,
      },
    ],
    constraints: input.confirmedBrief.targetClient.requiredCriteria,
    initialHypothesis: {
      targetClient: input.confirmedBrief.targetClient,
      targetSegments: input.confirmedBrief.targetSegments,
    },
    requestedVolume: input.confirmedBrief.desiredQualifiedCompanies,
  };
  const persisted = await createCampaignStrategyV2Draft({
    workspaceId: input.workspaceId,
    campaignExternalId: input.campaign.id,
    profileVersionId: profile.profileVersionId,
    campaignInput: campaignInput as unknown as Json,
    inputHash: hashCanonical(campaignInput),
    compiledContext: context,
  });
  await persistDeterministicBaseline({
    workspaceId: input.workspaceId,
    campaignExternalId: input.campaign.id,
    strategyDraftId: persisted.id,
    profileVersionId: profile.profileVersionId,
    offering,
    confirmedBrief: input.confirmedBrief,
    objectiveCode,
    geography,
    applicableRules: [
      ...context.applicableProfileRules,
      ...context.applicableOfferingRules,
    ],
    compiledContextHash: context.contextHash,
    campaignInput,
  });
  return { strategyDraftId: persisted.id };
}

async function persistDeterministicBaseline(input: {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
  profileVersionId: string;
  offering: Parameters<typeof buildNativeCampaignStrategyV2>[0]["offering"];
  confirmedBrief: ConfirmedCampaignBrief;
  objectiveCode: ReturnType<typeof resolveCampaignObjective>;
  geography: Parameters<typeof buildNativeCampaignStrategyV2>[0]["geography"];
  applicableRules: Parameters<
    typeof buildNativeCampaignStrategyV2
  >[0]["applicableProfileRules"];
  compiledContextHash: string;
  campaignInput: Record<string, unknown>;
}) {
  const contract = campaignStrategyBaselineContract;
  const frozenInputHash = hashCanonical({
    strategyDraftId: input.strategyDraftId,
    compiledContextHash: input.compiledContextHash,
    campaignInput: input.campaignInput,
  });
  const claimed = await claimCampaignStrategyStage({
    workspaceId: input.workspaceId,
    strategyDraftId: input.strategyDraftId,
    stageId: "baseline",
    cacheKey: intelligenceResultCacheKey({
      taskId: contract.taskId,
      frozenInputHash,
      promptVersion: contract.promptVersion,
      schemaVersion: contract.schemaVersion,
      contextCompilerVersion: contract.contextCompilerVersion,
      modelRouteVersion: campaignStrategyModelRouteVersion,
    }),
    inputHash: frozenInputHash,
    promptVersion: contract.promptVersion,
    schemaVersion: contract.schemaVersion,
    contextCompilerVersion: contract.contextCompilerVersion,
    modelRouteVersion: campaignStrategyModelRouteVersion,
    triggerRunId: "campaign-creation",
  });
  if (claimed.status === "completed") return;

  try {
    const draft = buildNativeCampaignStrategyV2({
      campaignId: input.campaignExternalId,
      strategyDraftId: input.strategyDraftId,
      profileVersionId: input.profileVersionId,
      offering: input.offering,
      confirmedBrief: input.confirmedBrief,
      objectiveCode: input.objectiveCode,
      geography: input.geography,
      applicableProfileRules: input.applicableRules,
    });
    const compilation = compileCampaignStrategyV2({
      draft,
      compiledContextHash: input.compiledContextHash,
    });
    await persistCampaignStrategyV2Compilation({
      workspaceId: input.workspaceId,
      strategyDraftId: input.strategyDraftId,
      compilation,
    });
    await completeCampaignStrategyStage({
      workspaceId: input.workspaceId,
      stageRunId: claimed.id,
      output: {
        contentHash: compilation.contentHash,
        compilerVersion: compilation.compilerVersion,
      },
    });
  } catch (error) {
    await failCampaignStrategyStage({
      workspaceId: input.workspaceId,
      stageRunId: claimed.id,
      error,
    });
    throw error;
  }
}

export async function resumeInitialCampaignStrategyV2(input: {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
}) {
  const prepared = await prepareCampaignStrategyV2Compilation(input);
  const marketSpecific = await generateMarketSpecificStrategy({
    frozenContext: prepared.storedContext,
    campaignInput: prepared.campaignInput,
  });
  await recordMarketStrategyCalls({
    workspaceId: input.workspaceId,
    strategyDraftId: prepared.recovery.id,
    inputHash:
      prepared.recovery.id + ":" + prepared.recovery.compiledContextHash,
    generated: marketSpecific,
  });
  const compilation = compileCampaignStrategyV2({
    draft: prepared.deterministicBase,
    compiledContextHash: prepared.recovery.compiledContextHash,
  });
  await persistCampaignStrategyV2Compilation({
    workspaceId: input.workspaceId,
    strategyDraftId: prepared.recovery.id,
    compilation,
  });
  return { strategyDraftId: prepared.recovery.id };
}

export async function prepareCampaignStrategyV2Compilation(input: {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
}) {
  const recovery = await getCampaignStrategyV2RecoveryData(input);
  if (!["building", "needs_input", "failed", "ready_for_review"].includes(recovery.state)) {
    throw new Error(`Campaign Strategy draft cannot be retried from ${recovery.state}.`);
  }
  const profile = await getPublishedCampaignPlanningProfile(input.workspaceId);
  if (!profile || profile.profileVersionId !== recovery.profileVersionId) {
    throw new Error(
      "The Company Intelligence version used by this campaign is no longer published.",
    );
  }
  const offeringReference = jsonObject(jsonArray(recovery.offeringReferences)[0]);
  const offeringVersionId = jsonString(offeringReference.offeringVersionId);
  const offering = profile.offerings.find(
    (candidate) => candidate.offeringVersionId === offeringVersionId,
  );
  if (!offering) {
    throw new Error("The offering used by this campaign is no longer available.");
  }
  const geography = campaignGeographyV2Schema.parse(recovery.geography);
  const objective = campaignObjectiveV2Schema.parse(recovery.objective);
  const hypothesis = jsonObject(recovery.initialHypothesis);
  const confirmedBrief = parseConfirmedCampaignBrief(
    {
      geography: {
        countryCodes: geography.countryCodes,
        regionLabel: geography.displayName,
        primaryLanguage: geography.workingLanguages[0] ?? "English",
      },
      offering: {
        profileOfferingIds: [offering.stableKey],
        title: offering.name,
        summary: offering.shortDescription,
        valueProposition:
          offering.commercialMechanics.valueProposition.join(" ") ||
          offering.shortDescription,
        rationale: "Recovered from the campaign's frozen offering selection.",
      },
      targetClient: hypothesis.targetClient,
      targetSegments: hypothesis.targetSegments,
      desiredQualifiedCompanies: recovery.requestedVolume,
    },
    new Set([offering.stableKey]),
  );
  const storedContext = jsonObject(recovery.compiledContext);
  if (
    !recovery.compiledContextHash ||
    jsonString(storedContext.contextHash) !== recovery.compiledContextHash
  ) {
    throw new Error("The frozen Campaign Strategy context is incomplete.");
  }
  const applicableRules = [
    ...jsonArray(storedContext.applicableProfileRules),
    ...jsonArray(storedContext.applicableOfferingRules),
  ].map((rule) => intelligenceRuleSchema.parse(rule));
  const deterministicBase = buildNativeCampaignStrategyV2({
    campaignId: input.campaignExternalId,
    strategyDraftId: recovery.id,
    profileVersionId: recovery.profileVersionId,
    offering,
    confirmedBrief,
    objectiveCode: objective.code,
    geography,
    applicableProfileRules: applicableRules,
  });
  const campaignInput = {
    entryContract: nativeCampaignStrategyEntryContract,
    geography,
    objective,
    offeringReferences: [
      {
        companyProfileVersionId: recovery.profileVersionId,
        offeringId: offering.offeringId,
        offeringVersionId: offering.offeringVersionId,
      },
    ],
    constraints: confirmedBrief.targetClient.requiredCriteria,
    initialHypothesis: hypothesis,
    requestedVolume: recovery.requestedVolume,
  };
  return { recovery, storedContext, campaignInput, deterministicBase };
}

function jsonObject(value: Json | undefined): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, Json | undefined>;
}

function jsonArray(value: Json | undefined): Json[] {
  return Array.isArray(value) ? value : [];
}

function jsonString(value: Json | undefined) {
  return typeof value === "string" ? value : "";
}

async function recordMarketStrategyCalls(input: {
  workspaceId: string;
  strategyDraftId: string;
  inputHash: string;
  generated: Awaited<ReturnType<typeof generateMarketSpecificStrategy>>;
}) {
  await recordCampaignStrategyModelCalls({
    workspaceId: input.workspaceId,
    strategyDraftId: input.strategyDraftId,
    inputHash: hashCanonical(input.inputHash),
    calls: [
      {
        taskId: campaignV2TaskContracts.marketContext.taskId,
        promptVersion: campaignV2TaskContracts.marketContext.promptVersion,
        schemaVersion: campaignV2TaskContracts.marketContext.schemaVersion,
        outputHash: hashCanonical(input.generated.marketContext),
        call: input.generated.marketCall,
      },
      {
        taskId: campaignV2TaskContracts.advisoryDelta.taskId,
        promptVersion: campaignV2TaskContracts.advisoryDelta.promptVersion,
        schemaVersion: campaignV2TaskContracts.advisoryDelta.schemaVersion,
        outputHash: hashCanonical(input.generated.strategyProposal),
        call: input.generated.strategyCall,
      },
    ],
  });
}
