import type { CompanyIntelligenceV3 } from "../company-profile-v3/schemas.ts";
import type { CampaignPlanningProfile } from "../campaign-strategy-v2/planning-profile.ts";
import { hashCanonical } from "../campaign-strategy-v2/context-compiler.ts";
import {
  commercialIntelligenceSchema,
  commercialRelationshipTypeSchema,
  type CommercialIntelligence,
  type CommercialRelationshipType,
} from "./commercial-intelligence.ts";

export const COMMERCIAL_INTELLIGENCE_SCHEMA_VERSION = "commercial-intelligence/v1";
export const COMMERCIAL_INTELLIGENCE_COMPILER_VERSION =
  "company-profile-v3-commercial-compiler/v1";

export function compileCommercialIntelligence(input: {
  artifactId: string;
  workspaceId: string;
  profile: CompanyIntelligenceV3;
  createdAt: string;
}): CommercialIntelligence {
  if (input.profile.status !== "published") {
    throw new Error("Commercial Intelligence requires a published Company Profile V3.");
  }

  const activeOfferings = input.profile.offerings.filter(
    ({ status }) => status === "active",
  );
  if (!activeOfferings.length) {
    throw new Error("Commercial Intelligence requires at least one active offering.");
  }
  const archetypesByOffering = new Map(
    activeOfferings.map(({ id }) => [
      id,
      input.profile.buyerArchetypes.filter(
        (archetype) =>
          archetype.offeringId === id &&
          archetype.priority !== "avoid" &&
          !["user_rejected", "superseded"].includes(archetype.status),
      ),
    ]),
  );

  const body = {
    workspaceId: input.workspaceId,
    companyProfileVersionId: input.profile.profileVersionId,
    seller: {
      name: input.profile.identity.publicName,
      businessRoles: uniqueSorted(
        input.profile.businessModel.roles.map(({ role }) => role),
      ),
      capabilities: uniqueSorted([
        ...input.profile.businessModel.valueCreation,
        ...input.profile.businessModel.valueDelivery,
      ]),
    },
    offerings: activeOfferings.map((offering) => {
      const archetypes = archetypesByOffering.get(offering.id) ?? [];
      const positiveSignals = compileSignals(
        offering.buyerLogic.positiveEvidenceSignals,
        offering.confidence,
        offering.evidenceIds,
      );
      const negativeSignals = compileSignals(
        offering.buyerLogic.negativeEvidenceSignals,
        offering.confidence,
        offering.evidenceIds,
      );
      return {
        offeringId: offering.id,
        offeringVersionId: offering.id,
        name: offering.name,
        summary: offering.shortDescription,
        valueProposition: uniqueSorted(offering.promisedOutcomes),
        capabilities: uniqueSorted([
          ...offering.buyerLogic.requiredCapabilities.map(({ statement }) => statement),
          ...offering.buyerLogic.preferredCharacteristics.map(
            ({ statement }) => statement,
          ),
        ]),
        useCases: uniqueSorted(offering.useCases),
        expectedOutcomes: uniqueSorted(offering.promisedOutcomes),
        customerProblems: uniqueSorted(offering.customerProblem),
        operationalUseCases: uniqueSorted(offering.useCases),
        requiredBuyerConditions: uniqueSorted(
          offering.buyerLogic.requiredCapabilities.map(({ statement }) => statement),
        ),
        preferredBuyerConditions: uniqueSorted(
          offering.buyerLogic.preferredCharacteristics.map(({ statement }) => statement),
        ),
        negativeBuyerConditions: uniqueSorted(
          offering.buyerLogic.incompatibleCharacteristics.map(
            ({ statement }) => statement,
          ),
        ),
        likelyBuyerRoles: uniqueSorted(
          offering.buyerLogic.buyerRoles.flatMap(({ jobFunctions }) => jobFunctions),
        ),
        procurementPatterns: uniqueSorted([
          offering.buyerLogic.procurementModel.motion,
          ...offering.buyerLogic.procurementModel.participants,
        ]).filter((value) => value !== "unknown"),
        possibleCustomerArchetypes: archetypes.map((archetype) => ({
          id: archetype.id,
          label: archetype.name,
          organizationType: archetype.description,
          businessRoles: uniqueSorted(archetype.businessRoles ?? []),
          businessModels: uniqueSorted(archetype.businessModels ?? []),
          industries: uniqueSorted(archetype.industries ?? []),
          sourcePriority: archetype.priority,
          rationale: joinRationale(archetype.whyCompatible, archetype.description),
          operationalUseCases: uniqueSorted([
            ...archetype.commercialNeed,
            ...archetype.whyCompatible,
          ]),
          requiredConditions: uniqueSorted(
            archetype.requiredConditions.map(({ statement }) => statement),
          ),
          preferredConditions: uniqueSorted(
            archetype.preferredConditions.map(({ statement }) => statement),
          ),
          negativeConditions: uniqueSorted(
            archetype.incompatibleConditions.map(({ statement }) => statement),
          ),
          likelyBuyerRoles: uniqueSorted(
            archetype.likelyBuyerRoles.flatMap(({ jobFunctions }) => jobFunctions),
          ),
          possibleRelationships: uniqueRelationships([
            archetype.relationshipType,
            ...offering.relationshipOptions
              .filter(({ relevance }) => relevance !== "avoid")
              .map(({ relationshipType }) => relationshipType),
          ]),
          positiveSignals: compileSignals(
            archetype.positiveEvidenceSignals,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          negativeSignals: compileSignals(
            archetype.negativeEvidenceSignals,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          scaleSignals: compileConditionScaleSignals({
            conditions: [
              ...archetype.requiredConditions,
              ...archetype.preferredConditions,
            ],
            keyPrefix: `archetype.${archetype.id}.scale`,
            confidence: archetype.confidence,
            evidenceIds: archetype.evidenceIds,
          }),
          buyingSignals: compileSignals(
            offering.buyerLogic.buyingTriggers,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          origin: "company_profile" as const,
          status: "hypothesis" as const,
          evidenceIds: uniqueSorted(archetype.evidenceIds),
          confidence: archetype.confidence,
        })),
        possibleRelationships: uniqueRelationships(
          offering.relationshipOptions
            .filter(({ relevance }) => relevance !== "avoid")
            .map(({ relationshipType }) => relationshipType),
        ),
        positiveSignals,
        negativeSignals,
        scaleDrivers: compileConditionScaleSignals({
          conditions: [
            ...offering.buyerLogic.requiredCapabilities,
            ...offering.buyerLogic.preferredCharacteristics,
          ],
          keyPrefix: `offering.${offering.id}.scale`,
          confidence: offering.confidence,
          evidenceIds: offering.evidenceIds,
        }),
        buyingTriggers: compileSignals(
          offering.buyerLogic.buyingTriggers,
          offering.confidence,
          offering.evidenceIds,
        ),
        ruleKeys: uniqueSorted(
          input.profile.rules
            .filter(
              (rule) =>
                rule.scope === "workspace" ||
                rule.applicability.offeringIds.includes(offering.id),
            )
            .map(({ ruleKey }) => ruleKey),
        ),
        evidenceIds: uniqueSorted([
          ...offering.evidenceIds,
          ...offering.buyerLogic.evidenceIds,
          ...archetypes.flatMap(({ evidenceIds }) => evidenceIds),
        ]),
        confidence: offering.confidence,
      };
    }),
    rules: input.profile.rules.filter(({ status }) => status !== "rejected"),
    claims: [],
    unknowns: uniqueSorted(input.profile.unresolvedCriticalConflictIds).map(
      (conflictId) => ({
        key: `profile-conflict.${conflictId}`,
        question: `Resolve the published Company Profile conflict ${conflictId}.`,
        importance: "critical" as const,
      }),
    ),
    evidenceIds: collectEvidenceIds(input.profile),
    confidence: aggregateConfidence(activeOfferings.map(({ confidence }) => confidence)),
  };
  const version = {
    schemaVersion: COMMERCIAL_INTELLIGENCE_SCHEMA_VERSION,
    compilerVersion: COMMERCIAL_INTELLIGENCE_COMPILER_VERSION,
    inputHash: hashCanonical({
      profile: input.profile,
      compilerVersion: COMMERCIAL_INTELLIGENCE_COMPILER_VERSION,
    }),
    contentHash: hashCanonical(body),
    createdAt: input.createdAt,
  };
  return commercialIntelligenceSchema.parse({ id: input.artifactId, ...body, version });
}

export function compileCommercialIntelligenceFromPlanningProfile(input: {
  artifactId: string;
  workspaceId: string;
  profile: CampaignPlanningProfile;
  createdAt: string;
}): CommercialIntelligence {
  if (!input.profile.offerings.length)
    throw new Error("Commercial Intelligence requires at least one active offering.");
  const offeringIdByVersionId = new Map(
    input.profile.offerings.map(({ offeringId, offeringVersionId }) => [
      offeringVersionId,
      offeringId,
    ]),
  );
  const body = {
    workspaceId: input.workspaceId,
    companyProfileVersionId: input.profile.profileVersionId,
    seller: {
      name: input.profile.companyName,
      businessRoles: uniqueSorted(input.profile.companyRoles),
      capabilities: uniqueSorted(
        input.profile.offerings.flatMap(
          ({ commercialMechanics }) => commercialMechanics.valueProposition,
        ),
      ),
    },
    offerings: input.profile.offerings.map((offering) => ({
      offeringId: offering.offeringId,
      offeringVersionId: offering.offeringVersionId,
      name: offering.name,
      summary: offering.shortDescription,
      valueProposition: uniqueSorted(offering.commercialMechanics.valueProposition),
      capabilities: uniqueSorted([
        ...offering.commercialMechanics.valueProposition,
        ...offering.buyerLogic.requiredConditions,
        ...offering.buyerLogic.preferredConditions,
      ]),
      useCases: uniqueSorted(offering.commercialMechanics.expectedOutcomes),
      expectedOutcomes: uniqueSorted(offering.commercialMechanics.expectedOutcomes),
      customerProblems: uniqueSorted(offering.commercialMechanics.customerProblems),
      operationalUseCases: uniqueSorted(offering.commercialMechanics.expectedOutcomes),
      requiredBuyerConditions: uniqueSorted(offering.buyerLogic.requiredConditions),
      preferredBuyerConditions: uniqueSorted(offering.buyerLogic.preferredConditions),
      negativeBuyerConditions: uniqueSorted(offering.buyerLogic.incompatibleConditions),
      likelyBuyerRoles: uniqueSorted(offering.buyerLogic.likelyDecisionRoles),
      procurementPatterns: uniqueSorted([
        ...(offering.buyerLogic.procurementPattern
          ? [offering.buyerLogic.procurementPattern]
          : []),
        ...offering.commercialMechanics.transactionModels,
      ]),
      possibleCustomerArchetypes: offering.archetypes
        .filter(
          ({ priority, status }) =>
            priority !== "avoid" && !["user_rejected", "superseded"].includes(status),
        )
        .map((archetype) => ({
          id: archetype.key,
          label: archetype.name,
          organizationType: archetype.description,
          businessRoles: uniqueSorted(archetype.businessRoles ?? []),
          businessModels: uniqueSorted(archetype.businessModels ?? []),
          industries: uniqueSorted(archetype.industries ?? []),
          sourcePriority: archetype.priority,
          rationale: joinRationale(archetype.whyCompatible, archetype.description),
          operationalUseCases: uniqueSorted([
            ...archetype.requiredEvidence,
            ...archetype.whyCompatible,
          ]),
          requiredConditions: uniqueSorted(archetype.requiredConditions ?? []),
          preferredConditions: uniqueSorted(archetype.preferredConditions ?? []),
          negativeConditions: uniqueSorted(archetype.incompatibleConditions ?? []),
          likelyBuyerRoles: uniqueSorted(archetype.likelyDecisionRoles),
          possibleRelationships: uniqueRelationships([
            archetype.relationshipType,
            ...offering.relationshipOptions
              .filter(({ relevance }) => relevance !== "avoid")
              .map(({ relationshipType }) => relationshipType),
          ]),
          positiveSignals: compileTextSignals(
            archetype.positiveSignals,
            `archetype.${archetype.key}.positive`,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          negativeSignals: compileTextSignals(
            archetype.negativeSignals,
            `archetype.${archetype.key}.negative`,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          scaleSignals: compileTextSignals(
            archetype.scaleSignals ?? [],
            `archetype.${archetype.key}.scale`,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          buyingSignals: compileTextSignals(
            uniqueSorted([
              ...(archetype.buyingTriggers ?? []),
              ...offering.buyerLogic.likelyTriggers,
            ]),
            `archetype.${archetype.key}.buying`,
            archetype.confidence,
            archetype.evidenceIds,
          ),
          origin: "company_profile" as const,
          status: "hypothesis" as const,
          evidenceIds: uniqueSorted(archetype.evidenceIds),
          confidence: archetype.confidence,
        })),
      possibleRelationships: uniqueRelationships(
        offering.relationshipOptions
          .filter(({ relevance }) => relevance !== "avoid")
          .map(({ relationshipType }) => relationshipType),
      ),
      positiveSignals: compileTextSignals(
        offering.buyerLogic.positiveEvidenceSignals,
        `offering.${offering.offeringId}.positive`,
        offering.buyerLogic.confidence,
        offering.buyerLogic.evidenceIds,
      ),
      negativeSignals: compileTextSignals(
        offering.buyerLogic.negativeEvidenceSignals,
        `offering.${offering.offeringId}.negative`,
        offering.buyerLogic.confidence,
        offering.buyerLogic.evidenceIds,
      ),
      scaleDrivers: compileTextSignals(
        offering.archetypes.flatMap(({ scaleSignals }) => scaleSignals ?? []),
        `offering.${offering.offeringId}.scale`,
        offering.buyerLogic.confidence,
        offering.buyerLogic.evidenceIds,
      ),
      buyingTriggers: compileTextSignals(
        offering.buyerLogic.likelyTriggers,
        `offering.${offering.offeringId}.buying`,
        offering.buyerLogic.confidence,
        offering.buyerLogic.evidenceIds,
      ),
      ruleKeys: uniqueSorted(
        input.profile.rules
          .filter(
            (rule) =>
              rule.scope === "workspace" ||
              rule.applicability.offeringIds.some(
                (id) => id === offering.offeringId || id === offering.offeringVersionId,
              ),
          )
          .map(({ ruleKey }) => ruleKey),
      ),
      evidenceIds: uniqueSorted([
        ...offering.buyerLogic.evidenceIds,
        ...offering.archetypes.flatMap(({ evidenceIds }) => evidenceIds),
      ]),
      confidence: offering.confidence,
    })),
    rules: input.profile.rules
      .filter(({ status }) => status !== "rejected")
      .map((rule) => ({
        ...rule,
        applicability: {
          ...rule.applicability,
          offeringIds: uniqueSorted(
            rule.applicability.offeringIds.map(
              (id) => offeringIdByVersionId.get(id) ?? id,
            ),
          ),
        },
      })),
    claims: [],
    unknowns: [],
    evidenceIds: uniqueSorted([
      ...input.profile.offerings.flatMap(({ buyerLogic }) => buyerLogic.evidenceIds),
      ...input.profile.offerings.flatMap(({ archetypes }) =>
        archetypes.flatMap(({ evidenceIds }) => evidenceIds),
      ),
      ...input.profile.rules.flatMap(({ evidenceIds }) => evidenceIds),
    ]),
    confidence: aggregateConfidence(
      input.profile.offerings.map(({ confidence }) => confidence),
    ),
  };
  return commercialIntelligenceSchema.parse({
    id: input.artifactId,
    ...body,
    version: {
      schemaVersion: COMMERCIAL_INTELLIGENCE_SCHEMA_VERSION,
      compilerVersion: COMMERCIAL_INTELLIGENCE_COMPILER_VERSION,
      inputHash: hashCanonical({
        profile: input.profile,
        compilerVersion: COMMERCIAL_INTELLIGENCE_COMPILER_VERSION,
      }),
      contentHash: hashCanonical(body),
      createdAt: input.createdAt,
    },
  });
}

function compileSignals(
  signals: Array<{
    key: string;
    description: string;
    confidence?: number;
    evidenceIds?: string[];
  }>,
  confidence: number,
  evidenceIds: string[],
) {
  return signals.map((signal) => ({
    key: signal.key,
    statement: signal.description,
    evidenceIds: uniqueSorted([...(signal.evidenceIds ?? []), ...evidenceIds]),
    confidence: signal.confidence ?? confidence,
  }));
}

function compileTextSignals(
  statements: string[],
  keyPrefix: string,
  confidence: number,
  evidenceIds: string[],
) {
  return uniqueSorted(statements).map((statement, index) => ({
    key: `${keyPrefix}.${index + 1}`,
    statement,
    evidenceIds: uniqueSorted(evidenceIds),
    confidence,
  }));
}

function compileConditionScaleSignals(input: {
  conditions: Array<{ key: string; statement: string; evidenceIds: string[] }>;
  keyPrefix: string;
  confidence: number;
  evidenceIds: string[];
}) {
  const scalePattern =
    /\b(?:scale|size|employee|revenue|turnover|location|site|branch|facility|capacity|volume|throughput|room|bed|unit|fleet|production|multi[- ]?site|business unit)\b/i;
  return input.conditions
    .filter(({ key, statement }) => scalePattern.test(`${key} ${statement}`))
    .map((condition, index) => ({
      key: `${input.keyPrefix}.${index + 1}`,
      statement: condition.statement,
      evidenceIds: uniqueSorted([...input.evidenceIds, ...condition.evidenceIds]),
      confidence: input.confidence,
    }));
}

function normalizeRelationship(value: string): CommercialRelationshipType {
  const normalized = value === "direct_buyer" ? "buyer" : value;
  return commercialRelationshipTypeSchema.safeParse(normalized).success
    ? (normalized as CommercialRelationshipType)
    : "other";
}

function uniqueRelationships(values: string[]) {
  return uniqueSorted(values.map(normalizeRelationship));
}

function collectEvidenceIds(profile: CompanyIntelligenceV3) {
  return uniqueSorted([
    ...profile.businessModel.evidenceIds,
    ...profile.businessModel.roles.flatMap(({ evidenceIds }) => evidenceIds),
    ...profile.offerings.flatMap(({ evidenceIds }) => evidenceIds),
    ...profile.offerings.flatMap(({ buyerLogic }) => buyerLogic.evidenceIds),
    ...profile.buyerArchetypes.flatMap(({ evidenceIds }) => evidenceIds),
    ...profile.rules.flatMap(({ evidenceIds }) => evidenceIds),
  ]);
}

function aggregateConfidence(values: number[]) {
  return values.length
    ? Number(
        (values.reduce((total, value) => total + value, 0) / values.length).toFixed(4),
      )
    : 0;
}

function joinRationale(values: string[], fallback: string) {
  return values.length ? values.join(" ") : fallback;
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort(
    compareText,
  );
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
