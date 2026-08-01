import {
  parseConfirmedCampaignBrief,
  type ConfirmedCampaignBrief,
} from "@/lib/campaign-workflow/contracts";
import {
  buildNativeCampaignStrategyV2,
  campaignGeographyV2Schema,
  campaignObjectiveV2Schema,
  canRetryCampaignStrategyV2Draft,
  compileCampaignCommercialContext,
  compileCampaignStrategyV2,
  hashCanonical,
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
} from "./repository";

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
  const draft = buildNativeCampaignStrategyV2({
    campaignId: input.campaign.id,
    strategyDraftId: persisted.id,
    profileVersionId: profile.profileVersionId,
    offering,
    confirmedBrief: input.confirmedBrief,
    objectiveCode,
    geography,
    applicableProfileRules: [
      ...context.applicableProfileRules,
      ...context.applicableOfferingRules,
    ],
  });
  const compilation = compileCampaignStrategyV2({
    draft,
    compiledContextHash: context.contextHash,
  });
  await persistCampaignStrategyV2Compilation({
    workspaceId: input.workspaceId,
    strategyDraftId: persisted.id,
    compilation,
  });
  return { strategyDraftId: persisted.id };
}

export async function resumeInitialCampaignStrategyV2(input: {
  workspaceId: string;
  campaignExternalId: string;
  strategyDraftId: string;
}) {
  const recovery = await getCampaignStrategyV2RecoveryData(input);
  if (!canRetryCampaignStrategyV2Draft(recovery.state)) {
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
  const draft = buildNativeCampaignStrategyV2({
    campaignId: input.campaignExternalId,
    strategyDraftId: recovery.id,
    profileVersionId: recovery.profileVersionId,
    offering,
    confirmedBrief,
    objectiveCode: objective.code,
    geography,
    applicableProfileRules: applicableRules,
  });
  const compilation = compileCampaignStrategyV2({
    draft,
    compiledContextHash: recovery.compiledContextHash,
  });
  await persistCampaignStrategyV2Compilation({
    workspaceId: input.workspaceId,
    strategyDraftId: recovery.id,
    compilation,
  });
  return { strategyDraftId: recovery.id };
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
